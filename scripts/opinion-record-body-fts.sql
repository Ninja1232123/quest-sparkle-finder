-- opinion-record-body-fts.sql — add full-text body search to SCOTUS opinions.
--
-- WHY: state_supreme_opinions already has a body_tsv (full-text body index), so the
-- workspace assistant can search the *text* of 528k state opinions. opinion_record
-- (28.5k SCOTUS opinions) only had title_tsv — you could match a case name but not
-- the holding. This adds a generated body_tsv + GIN index so SCOTUS reaches parity:
-- search the actual opinion text, not just the caption.
--
-- Run on the box (self_law), as a user that owns opinion_record:
--     psql -d self_law -f scripts/opinion-record-body-fts.sql
--
-- Idempotent. The column is GENERATED ALWAYS so it stays in sync with no trigger.
-- After this runs, flip the SCOTUS branch of search_cases from `title_tsv` to
-- `body_tsv` in src/routes/api/workspace/chat.ts and src/lib/workspace.functions.ts
-- (one .textSearch("title_tsv", …) → .textSearch("body_tsv", …) in each) to use it.

BEGIN;

ALTER TABLE public.opinion_record
  ADD COLUMN IF NOT EXISTS body_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(body_text, ''))) STORED;

CREATE INDEX IF NOT EXISTS opinion_record_body_tsv_idx
  ON public.opinion_record USING gin (body_tsv);

COMMIT;

-- Let PostgREST pick up the new column immediately.
-- (If this NOTIFY errors because of ownership, run from the shell instead:
--   kill -SIGUSR1 $(pgrep -f 'postgrest') )
NOTIFY pgrst, 'reload schema';

-- Sanity check after running:
--   SELECT slug, case_title FROM opinion_record
--   WHERE body_tsv @@ websearch_to_tsquery('english', 'qualified immunity')
--   LIMIT 5;
