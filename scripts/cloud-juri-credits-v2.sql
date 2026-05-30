-- ============================================================================
-- cloud-juri-credits-v2.sql  —  RUN IN THE CLOUD SUPABASE PROJECT
-- Dashboard → SQL Editor → paste → Run.  (NOT the local self_law DB.)
--
-- Evolves the Juri credit system from a single `balance` into TWO buckets so
-- the Pro plan and pay-as-you-go top-ups coexist correctly:
--
--   monthly_credits  — granted each Pro billing cycle, RESET (no rollover).
--                      Spent FIRST. Webhook overwrites to PRO_MONTHLY each
--                      `invoice.paid` (idempotent per billing period).
--   topup_credits    — bought in one-time packs. NEVER expire. Spent after
--                      the monthly bucket is empty.
--   balance          — generated total (monthly + topup); the old read path
--                      (`select balance`) keeps working unchanged.
--
-- Layers on top of cloud-juri-credits.sql (kept as the base/fallback) but is
-- self-contained and idempotent — safe to run whether or not the base ran.
-- ============================================================================

-- 1. Base table (no-op if the base script already created it). -----------------
create table if not exists public.juri_credits (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  balance    integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Add the two buckets. ------------------------------------------------------
alter table public.juri_credits
  add column if not exists monthly_credits integer not null default 0;
alter table public.juri_credits
  add column if not exists topup_credits integer not null default 0;

-- 3. One-time backfill: legacy single balance → topup bucket (persists).
--    Guard makes re-runs a no-op (after migration, topup>0 so the row is skipped).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'juri_credits'
      and column_name = 'balance' and is_generated = 'NEVER'
  ) then
    update public.juri_credits
      set topup_credits = balance
      where balance > 0 and monthly_credits = 0 and topup_credits = 0;
  end if;
end $$;

-- 4. Replace `balance` with a generated total so old reads still work. ---------
--    (Drop the plain column, re-add as STORED generated. Idempotent: if it's
--    already generated, the drop+re-add just recomputes.)
alter table public.juri_credits drop column if exists balance;
alter table public.juri_credits
  add column balance integer generated always as (monthly_credits + topup_credits) stored;

alter table public.juri_credits enable row level security;
drop policy if exists juri_credits_read_own on public.juri_credits;
create policy juri_credits_read_own on public.juri_credits
  for select using (auth.uid() = user_id);

-- 5. Deduct one credit — MONTHLY first, then TOPUP. Returns true if charged. ----
create or replace function public.deduct_juri_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  charged boolean := false;
begin
  -- Spend the monthly allowance first.
  update public.juri_credits
    set monthly_credits = monthly_credits - 1, updated_at = now()
    where user_id = p_user_id and monthly_credits > 0;
  if found then return true; end if;

  -- Otherwise spend a purchased top-up credit.
  update public.juri_credits
    set topup_credits = topup_credits - 1, updated_at = now()
    where user_id = p_user_id and topup_credits > 0;
  return found;
end;
$$;
grant execute on function public.deduct_juri_credit(uuid) to authenticated;

-- 6. Add TOP-UP credits (Stripe pack purchase, admin grant). Returns new total.-
create or replace function public.add_topup_credits(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  insert into public.juri_credits (user_id, topup_credits)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set topup_credits = juri_credits.topup_credits + p_amount,
        updated_at = now()
  returning balance into v_total;
  return v_total;
end;
$$;

-- Back-compat: old name now routes to the top-up bucket.
create or replace function public.add_juri_credits(p_user_id uuid, p_amount integer)
returns integer language plpgsql security definer set search_path = public as $$
begin
  return public.add_topup_credits(p_user_id, p_amount);
end;
$$;

-- 7. Pro monthly grant ledger — one grant per (user, billing period). ----------
create table if not exists public.juri_pro_grants (
  user_id    uuid not null references auth.users(id) on delete cascade,
  period_key text not null,                 -- Stripe billing period start (epoch as text)
  amount     integer not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, period_key)
);
alter table public.juri_pro_grants enable row level security;  -- service-role only; no policies

-- Set the monthly allowance to p_amount (RESET, not add). Idempotent per period:
-- the first call for a period grants; repeats are no-ops. Top-ups are untouched.
create or replace function public.set_pro_monthly_credits(
  p_user_id uuid, p_period_key text, p_amount integer
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_total integer;
begin
  -- Claim this period; if already claimed, do nothing.
  insert into public.juri_pro_grants (user_id, period_key, amount)
  values (p_user_id, p_period_key, p_amount)
  on conflict (user_id, period_key) do nothing;
  if not found then
    select balance into v_total from public.juri_credits where user_id = p_user_id;
    return coalesce(v_total, 0);
  end if;

  insert into public.juri_credits (user_id, monthly_credits)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set monthly_credits = p_amount, updated_at = now()   -- RESET to the floor
  returning balance into v_total;
  return v_total;
end;
$$;

-- 8. Query log + purchase log (no-ops if base script already made them). -------
create table if not exists public.juri_queries (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users(id) on delete set null,
  query              text not null,
  sources_consulted  text[] not null default '{}',
  tokens_used        integer not null default 0,
  credited           boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists juri_queries_user_idx on public.juri_queries (user_id, created_at desc);
alter table public.juri_queries enable row level security;
drop policy if exists juri_queries_read_own on public.juri_queries;
create policy juri_queries_read_own on public.juri_queries
  for select using (auth.uid() = user_id);

create table if not exists public.juri_credit_purchases (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  amount                 integer not null,
  price_cents            integer not null,
  stripe_payment_intent  text,
  environment            text not null default 'live',
  created_at             timestamptz not null default now()
);
-- Idempotency for the webhook: never grant the same payment twice.
create unique index if not exists juri_credit_purchases_pi_uniq
  on public.juri_credit_purchases (stripe_payment_intent)
  where stripe_payment_intent is not null;
create index if not exists juri_credit_purchases_user_idx
  on public.juri_credit_purchases (user_id, created_at desc);
alter table public.juri_credit_purchases enable row level security;
drop policy if exists juri_purchases_read_own on public.juri_credit_purchases;
create policy juri_purchases_read_own on public.juri_credit_purchases
  for select using (auth.uid() = user_id);

-- ============================================================================
\echo
\echo '=== Juri credits v2 (monthly + topup buckets) ready ==='
select
  (select count(*) from public.juri_credits) as users_with_credits,
  (select coalesce(sum(monthly_credits),0) from public.juri_credits) as monthly_outstanding,
  (select coalesce(sum(topup_credits),0) from public.juri_credits)   as topup_outstanding;
