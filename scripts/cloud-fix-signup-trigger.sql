-- ============================================================================
-- cloud-fix-signup-trigger.sql — RUN IN CLOUD SUPABASE (vjaiqbybhurvnlfladkg)
-- Dashboard → SQL Editor → paste → Run.  (NOT the local self_law DB.)
--
-- FIXES: "Database error saving new user" — every signup is blocked.
--
-- cloud-juri-credits-v2.sql made juri_credits.balance a GENERATED column
-- (balance = monthly_credits + topup_credits), but the signup trigger
-- grant_starter_juri_credits() still INSERTs into balance. Postgres rejects an
-- insert into a generated column, the AFTER INSERT trigger on auth.users aborts,
-- and the whole signup fails. Re-point the starter 3 credits at topup_credits
-- (persistent bucket); balance then computes to 3 as before. Idempotent.
-- ============================================================================
create or replace function public.grant_starter_juri_credits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.juri_credits (user_id, topup_credits)
  values (new.id, 3)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Backfill: any users created while signup was half-broken still get a profile/
-- credits row if they slipped through (no-op if already present).
insert into public.juri_credits (user_id, topup_credits)
select id, 3 from auth.users
on conflict (user_id) do nothing;
