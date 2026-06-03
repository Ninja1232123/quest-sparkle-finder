-- Serving slice — stat pages (federal civil v1)
-- ------------------------------------------------------------------
-- Rolls outcome_cube down to thin, page-shaped tables ready to project to
-- the cloud serving DB. Two faces (COURT_DATA_SPEC.md §8): every row is both a
-- standalone SEO landing page (slug) and the data woven into law/court pages.
--
-- Taxonomy (user pick): NOS families as the browse spine + every code a leaf.
-- Scopes built (federal civil first):
--   family_national    /outcomes/federal/<family>
--   casetype_national  /outcomes/federal/<family>/<code>-<slug>
--   court              /outcomes/federal/court/<court>
--   court_casetype     /outcomes/federal/court/<court>/<code>-<slug>   (>=25 cases)
--
-- Requires: outcome-cube.sql already run (outcome_cube, nos_label).
-- Run:  psql "$URI" -f scripts/stat-pages-build.sql
-- ------------------------------------------------------------------

-- NOS code -> ~14 readable families (numeric ranges + a few reassignments).
CREATE OR REPLACE FUNCTION juri_nos_family(code int)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN code BETWEEN 110 AND 199 THEN 'Contract'
    WHEN code BETWEEN 210 AND 299 THEN 'Real Property'
    WHEN code BETWEEN 310 AND 385 THEN 'Torts'
    WHEN code BETWEEN 440 AND 448 THEN 'Civil Rights'
    WHEN code IN (460,462,463,465)  THEN 'Immigration'
    WHEN code BETWEEN 510 AND 560 THEN 'Prisoner Petitions'
    WHEN code BETWEEN 610 AND 699 THEN 'Forfeiture & Penalty'
    WHEN code BETWEEN 710 AND 799 THEN 'Labor & Employment'
    WHEN code IN (820,830,835,840,880) THEN 'Intellectual Property'
    WHEN code BETWEEN 860 AND 865 THEN 'Social Security'
    WHEN code IN (870,871) THEN 'Tax'
    WHEN code IN (422,423) THEN 'Bankruptcy'
    WHEN code IN (430,470,480,485,850) THEN 'Financial & Securities'
    ELSE 'Other Federal Statutes'
  END
$$;

-- url-safe slug
CREATE OR REPLACE FUNCTION juri_slug(t text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT trim(both '-' FROM regexp_replace(lower(coalesce(t,'')), '[^a-z0-9]+', '-', 'g'))
$$;

-- 1. Long-format outcome counts per page (explode each cube cell into its scopes)
DROP TABLE IF EXISTS stat_outcome;
CREATE TABLE stat_outcome AS
WITH base AS (
  SELECT c.court_id, sc.full_name AS court_name,
         c.case_type::int AS nos, l.label AS nos_label,
         juri_nos_family(c.case_type::int) AS family,
         c.outcome, c.n
  FROM outcome_cube c
  JOIN search_court sc ON sc.id = c.court_id
  LEFT JOIN nos_label l ON l.code = c.case_type::int
  WHERE c.layer = 'federal_civil' AND c.case_type ~ '^[0-9]+$'
),
exploded AS (
  SELECT s.scope, s.slug, s.court_id, s.court_name, s.family, s.nos_code, s.nos_label, b.outcome, b.n
  FROM base b
  CROSS JOIN LATERAL (VALUES
    ('family_national',
       '/outcomes/federal/'||juri_slug(b.family),
       NULL::varchar, NULL::text, b.family, NULL::int, NULL::text),
    ('casetype_national',
       '/outcomes/federal/'||juri_slug(b.family)||'/'||b.nos||'-'||juri_slug(b.nos_label),
       NULL::varchar, NULL::text, b.family, b.nos, b.nos_label),
    ('court',
       '/outcomes/federal/court/'||juri_slug(b.court_name),
       b.court_id, b.court_name, NULL::text, NULL::int, NULL::text),
    ('court_casetype',
       '/outcomes/federal/court/'||juri_slug(b.court_name)||'/'||b.nos||'-'||juri_slug(b.nos_label),
       b.court_id, b.court_name, b.family, b.nos, b.nos_label)
  ) AS s(scope, slug, court_id, court_name, family, nos_code, nos_label)
)
SELECT scope, slug, court_id, court_name, family, nos_code, nos_label,
       outcome, sum(n)::bigint AS n
FROM exploded
GROUP BY scope, slug, court_id, court_name, family, nos_code, nos_label, outcome;

-- 2. Page registry + headline summary (one row per slug)
DROP TABLE IF EXISTS stat_page;
CREATE TABLE stat_page AS
SELECT
  slug,
  max(scope)        AS scope,
  'federal_civil'::text AS layer,
  max(court_id)     AS court_id,
  max(court_name)   AS court_name,
  max(family)       AS family,
  max(nos_code)     AS nos_code,
  max(nos_label)    AS nos_label,
  sum(n)            AS total_cases,
  sum(n) FILTER (WHERE outcome IN ('plaintiff_win','defendant_win','mixed','decided_other')) AS merits_cases,
  sum(n) FILTER (WHERE outcome = 'plaintiff_win') AS plaintiff_win,
  sum(n) FILTER (WHERE outcome = 'defendant_win') AS defendant_win,
  sum(n) FILTER (WHERE outcome = 'settled')   AS settled,
  sum(n) FILTER (WHERE outcome = 'dismissed') AS dismissed,
  -- headline plaintiff-win rate among merits judgments; NULL when sample too thin (UPL guard)
  CASE WHEN sum(n) FILTER (WHERE outcome IN ('plaintiff_win','defendant_win','mixed','decided_other')) >= 30
       THEN round(100.0 * sum(n) FILTER (WHERE outcome='plaintiff_win')
            / NULLIF(sum(n) FILTER (WHERE outcome IN ('plaintiff_win','defendant_win','mixed','decided_other')),0), 1)
  END AS plaintiff_win_pct,
  -- generic state-appellate columns (NULL for federal rows; populated by
  -- state-stat-pages-build.sql, whose metric is reversal rate, not who-won)
  NULL::text    AS state,
  NULL::text    AS state_slug,
  NULL::text    AS court_level,
  NULL::bigint  AS decided_cases,
  NULL::numeric AS reversal_pct,
  NULL::numeric AS remand_pct
FROM stat_outcome
GROUP BY slug;

-- 3. Quality floor: drop court×case-type pages with too few cases to be meaningful
DELETE FROM stat_page    WHERE scope='court_casetype' AND total_cases < 25;
DELETE FROM stat_outcome o WHERE NOT EXISTS (SELECT 1 FROM stat_page p WHERE p.slug=o.slug);

ALTER TABLE stat_page ADD PRIMARY KEY (slug);
CREATE INDEX stat_page_scope_idx  ON stat_page (scope);
CREATE INDEX stat_page_family_idx ON stat_page (family);
CREATE INDEX stat_page_court_idx  ON stat_page (court_id);
CREATE INDEX stat_page_nos_idx    ON stat_page (nos_code);
CREATE INDEX stat_page_state_idx  ON stat_page (layer, state_slug);
CREATE INDEX stat_outcome_slug_idx ON stat_outcome (slug);
ANALYZE stat_page;
ANALYZE stat_outcome;
