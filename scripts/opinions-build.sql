-- Court Record — Supreme Court opinions serving table
-- ------------------------------------------------------------------
-- Surfaces the dormant `scotus_clean` table (63,762 public-domain SCOTUS
-- opinions, full body text; provenance: a Kaggle SCOTUS dump = repackaged
-- public-domain CourtListener/US Reports text). It's the ONLY opinion text on
-- disk — the CourtListener bulk `opinions` (52GB) was deliberately skipped.
--
-- Keep the ~28.5k SUBSTANTIAL opinions (body >= 2000 chars); the other ~32k are
-- one-line cert denials / orders. `theme` is empty and there are no date/court
-- columns, but the US Reports cite (~96%) and year (~75%) sit in the opening
-- line of each opinion — extract them to organize by era + citation.
--
-- Runs against self_law (where scotus_clean lives); serves directly, no move.
--   psql "$SELF_URI" -f scripts/opinions-build.sql
-- ------------------------------------------------------------------

-- url-safe slug (self_law may not have it; courtlistener's copy is separate)
CREATE OR REPLACE FUNCTION juri_slug(t text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT trim(both '-' FROM regexp_replace(lower(coalesce(t,'')), '[^a-z0-9]+', '-', 'g'))
$$;

DROP TABLE IF EXISTS opinion_record;
CREATE TABLE opinion_record AS
WITH base AS (
  SELECT
    id,
    case_title,
    body_text,
    coalesce(array_length(cited_cases, 1), 0) AS cited_count,
    length(body_text) AS body_len,
    nullif(left(juri_slug(case_title), 90), '') AS base_slug,
    regexp_match(body_text, '(\d{1,3}) U\.?\s?S\.?\s+(\d{1,4})') AS usm,
    (regexp_match(left(body_text, 600), '\((1[789]\d\d|20[0-2]\d)\)'))[1] AS yr
  FROM scotus_clean
  WHERE length(body_text) >= 2000
),
slugged AS (
  SELECT *,
    -- dedupe colliding slugs by appending the id; fall back to opinion-<id>
    CASE
      WHEN base_slug IS NULL THEN 'opinion-' || id
      WHEN count(*) OVER (PARTITION BY base_slug) > 1 THEN base_slug || '-' || id
      ELSE base_slug
    END AS slug
  FROM base
)
SELECT
  id,
  slug,
  case_title,
  CASE WHEN usm IS NOT NULL THEN usm[1] || ' U.S. ' || usm[2] END AS us_cite,
  yr::int AS year,
  CASE WHEN yr IS NOT NULL THEN (yr::int / 10) * 10 END AS decade,
  upper(left(regexp_replace(case_title, '^[^A-Za-z]+', ''), 1)) AS first_letter,
  cited_count,
  body_len,
  body_text,
  to_tsvector('english', case_title) AS title_tsv
FROM slugged;

ALTER TABLE opinion_record ADD PRIMARY KEY (slug);
CREATE INDEX opinion_record_decade_idx ON opinion_record (decade);
CREATE INDEX opinion_record_letter_idx ON opinion_record (first_letter);
CREATE INDEX opinion_record_year_idx   ON opinion_record (year);
CREATE INDEX opinion_record_tsv_idx    ON opinion_record USING gin (title_tsv);

-- serving grants (match the stat_page / document_sections pattern)
ALTER TABLE opinion_record OWNER TO app_user;
GRANT SELECT ON opinion_record TO anon, selflaw_web, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON opinion_record TO claude_mcp;

ANALYZE opinion_record;
NOTIFY pgrst, 'reload schema';
