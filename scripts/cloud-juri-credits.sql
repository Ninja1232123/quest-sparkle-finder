-- ============================================================================
-- cloud-juri-credits.sql  —  RUN IN THE CLOUD SUPABASE PROJECT
-- Dashboard → SQL Editor → paste → Run.  (NOT the local self_law DB.)
--
-- Stands up the credit system and query log for Juri (the eagle AI).
-- Credits are simple: integer balance per user, atomic deduct-if-positive.
-- Usage log captures every query (credited or not) for search metadata.
-- Idempotent.
-- ============================================================================

-- 1. Credits table — one row per user, tracks current balance.
create table if not exists public.juri_credits (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  balance    integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.juri_credits enable row level security;

-- Users can read their own balance.
drop policy if exists juri_credits_read_own on public.juri_credits;
create policy juri_credits_read_own on public.juri_credits
  for select using (auth.uid() = user_id);

-- No direct user INSERT/UPDATE — only the service role (server functions) writes.

-- 2. Atomic credit deduction — returns true if deducted, false if insufficient.
create or replace function public.deduct_juri_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  update public.juri_credits
  set balance = balance - 1,
      updated_at = now()
  where user_id = p_user_id
    and balance > 0
  returning balance into v_new_balance;

  return found;
end;
$$;

grant execute on function public.deduct_juri_credit(uuid) to authenticated;

-- 3. Add credits (for purchases, admin grants, signup bonuses).
create or replace function public.add_juri_credits(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  insert into public.juri_credits (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
  set balance = juri_credits.balance + p_amount,
      updated_at = now()
  returning balance into v_new_balance;

  return v_new_balance;
end;
$$;

-- Only callable by service role (no grant to authenticated).

-- 4. Query log — every Juri interaction, credited or not.
-- This is the search metadata gold mine: what do people actually ask about?
create table if not exists public.juri_queries (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users(id) on delete set null,
  query              text not null,
  sources_consulted  text[] not null default '{}',
  tokens_used        integer not null default 0,
  credited           boolean not null default false,
  created_at         timestamptz not null default now()
);

create index if not exists juri_queries_user_idx
  on public.juri_queries (user_id, created_at desc);
create index if not exists juri_queries_created_idx
  on public.juri_queries (created_at desc);

alter table public.juri_queries enable row level security;

-- Users can read their own query history.
drop policy if exists juri_queries_read_own on public.juri_queries;
create policy juri_queries_read_own on public.juri_queries
  for select using (auth.uid() = user_id);

-- Service role inserts (no user insert policy).

-- 5. Credit purchase log — ties Stripe payments to credit additions.
create table if not exists public.juri_credit_purchases (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  amount                 integer not null,
  price_cents            integer not null,
  stripe_payment_intent  text,
  environment            text not null default 'live',
  created_at             timestamptz not null default now()
);

create index if not exists juri_credit_purchases_user_idx
  on public.juri_credit_purchases (user_id, created_at desc);

alter table public.juri_credit_purchases enable row level security;

drop policy if exists juri_purchases_read_own on public.juri_credit_purchases;
create policy juri_purchases_read_own on public.juri_credit_purchases
  for select using (auth.uid() = user_id);

-- 6. Auto-grant starter credits on signup (3 free queries to hook them).
-- Uses the existing handle_new_user trigger — we add credits after the
-- profile insert. If the trigger already ran, this is a no-op per ON CONFLICT.
create or replace function public.grant_starter_juri_credits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.juri_credits (user_id, balance)
  values (new.id, 3)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_juri_credits on auth.users;
create trigger on_auth_user_juri_credits
  after insert on auth.users
  for each row execute function public.grant_starter_juri_credits();

-- Backfill: give 3 starter credits to existing users who don't have any.
insert into public.juri_credits (user_id, balance)
select id, 3 from auth.users
on conflict (user_id) do nothing;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
\echo
\echo '=== Juri credits setup complete ==='
select
  (select count(*) from public.juri_credits) as users_with_credits,
  (select coalesce(sum(balance), 0) from public.juri_credits) as total_credits_outstanding;
