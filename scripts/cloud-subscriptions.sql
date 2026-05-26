-- ============================================================================
-- cloud-subscriptions.sql  —  RUN IN THE CLOUD SUPABASE PROJECT (vjaiqbybhurvnlfladkg)
-- Dashboard → SQL Editor → paste → Run.  (NOT the local self_law DB.)
--
-- Backing table for the $5 Pro paywall. Users read their OWN subscription
-- (RLS); the Stripe webhook writes rows with the service-role key, which
-- bypasses RLS — so there is intentionally no user INSERT/UPDATE policy.
-- Idempotent.
-- ============================================================================

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_customer_id     text,
  product_id             text,
  price_id               text,
  status                 text not null default 'incomplete',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  environment            text not null default 'live',  -- 'live' | 'sandbox'
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id, environment, created_at desc);

alter table public.subscriptions enable row level security;

-- Read your own subscription(s). No write policy: only the service-role
-- webhook writes, and service role bypasses RLS.
drop policy if exists subscriptions_read_own on public.subscriptions;
create policy subscriptions_read_own on public.subscriptions
  for select using (auth.uid() = user_id);
