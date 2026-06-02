-- Cap document_sections.search_tsv input length.
--
-- The generated search_tsv column ran to_tsvector over the FULL body_text with
-- no length bound. The federal corpus never had a single section big enough to
-- matter, but the state corpus does: a few sections (IL 1.24MB, OK 1.0MB, MD,
-- WV) produce a tsvector larger than Postgres's hard 1,048,575-byte tsvector
-- limit, so INSERT fails with "string is too long for tsvector".
--
-- state_sections already caps its own tsvector at left(body_text, 500000); this
-- brings document_sections in line. Effect: sections longer than 500k chars are
-- fully readable but only their first 500k chars are full-text indexed — the
-- same trade state_sections already makes. The `documents` view selects this
-- column, so it's dropped and recreated around the change.

BEGIN;

DROP VIEW IF EXISTS public.documents;

ALTER TABLE public.document_sections DROP COLUMN search_tsv;

ALTER TABLE public.document_sections
  ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      (COALESCE(heading, '') || ' ') || left(COALESCE(body_text, ''), 500000))
  ) STORED;

CREATE INDEX document_sections_search_idx
  ON public.document_sections USING gin (search_tsv);

CREATE VIEW public.documents AS
  SELECT id, source_code, identifier, parent_label, section_label, heading,
         body_text, body_md, hierarchy, word_count, created_at, search_tsv,
         embedding, sort_key
  FROM public.document_sections;

COMMIT;
