-- ============================================================================
-- cloud-juri-interpretations.sql  —  RUN IN THE CLOUD SUPABASE PROJECT
-- Dashboard → SQL Editor → paste → Run.  (NOT the local self_law DB.)
--
-- Records the plain-English readings Juri gives for specific sections, as
-- labeled "AI interpretations" — never authoritative, never legal advice.
-- Keyed by section identifier so they compound into a corpus asset: the raw
-- material for the future plain-English layer, plus eval/training data.
--
-- Written by the Juri server (askJuri) via the service-role key, which bypasses
-- RLS — so there's no INSERT policy here, only a read-own SELECT policy. The
-- server only records a reading Juri deliberately noted via the
-- note_interpretation tool, for a section it actually read.
-- Self-contained and idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.juri_interpretations (
  id              uuid primary key default gen_random_uuid(),
  identifier      text not null,                                  -- the section interpreted
  source_code     text,                                           -- e.g. usc, cfr, ucc (null if unknown)
  interpretation  text not null,                                  -- Juri's plain-English reading
  query           text,                                           -- the question that prompted it
  user_id         uuid references auth.users(id) on delete set null,
  model           text,                                           -- model that produced the reading
  mode            text,                                           -- quick | deep
  created_at      timestamptz not null default now()
);

-- "Latest interpretation(s) for a section" — the primary read pattern.
create index if not exists juri_interpretations_identifier_idx
  on public.juri_interpretations (identifier, created_at desc);
create index if not exists juri_interpretations_user_idx
  on public.juri_interpretations (user_id, created_at desc);

alter table public.juri_interpretations enable row level security;
-- Users may read interpretations their own questions produced. The server
-- writes with the service-role key (RLS-exempt), so no INSERT policy is needed.
drop policy if exists juri_interpretations_read_own on public.juri_interpretations;
create policy juri_interpretations_read_own on public.juri_interpretations
  for select using (auth.uid() = user_id);
