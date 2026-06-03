-- Serving slice — state appellate stat pages
-- ------------------------------------------------------------------
-- The state companion to stat-pages-build.sql. Where federal answers "who wins"
-- (plaintiff-win rate from IDB), state appellate answers "do appeals succeed"
-- (REVERSAL RATE, from cluster_outcome). Different metric, different taxonomy:
-- state has no case-type axis, so pages are PER COURT — and supreme vs.
-- intermediate-appellate courts get SEPARATE pages (a 35% supreme reversal rate
-- and its court-of-appeals rate mean different things).
--
-- Honest limits: appellate-only (no trial who-won), classifier-derived (~95.6%),
-- and disposition is sparse — only courts/levels with enough decided cases get a
-- rate. Carries the "check your local rules" asterisk in the UI footer.
--
-- Requires: state-outcome-classifier.sql (cluster_outcome) + stat-pages-build.sql
-- (creates stat_page/stat_outcome incl. the generic state columns) already run.
-- Run AFTER the federal build, BEFORE stat-pages-serve.sh:
--   psql "$URI" -f scripts/state-stat-pages-build.sql
-- ------------------------------------------------------------------

-- Safety: ensure the generic state columns exist even if an older federal build ran.
ALTER TABLE stat_page ADD COLUMN IF NOT EXISTS state         text;
ALTER TABLE stat_page ADD COLUMN IF NOT EXISTS state_slug    text;
ALTER TABLE stat_page ADD COLUMN IF NOT EXISTS court_level   text;
ALTER TABLE stat_page ADD COLUMN IF NOT EXISTS decided_cases bigint;
ALTER TABLE stat_page ADD COLUMN IF NOT EXISTS reversal_pct  numeric;
ALTER TABLE stat_page ADD COLUMN IF NOT EXISTS remand_pct    numeric;

-- 1. Court -> state map. No clean state field in CourtListener, so match the
--    state name inside full_name, longest name wins (so "West Virginia" beats
--    "Virginia", "South Dakota" beats nothing-shorter, etc.).
DROP TABLE IF EXISTS state_court_map;
CREATE TEMP TABLE state_court_map AS
WITH states(name, slug) AS (VALUES
  ('Alabama','alabama'),('Alaska','alaska'),('Arizona','arizona'),('Arkansas','arkansas'),
  ('California','california'),('Colorado','colorado'),('Connecticut','connecticut'),
  ('Delaware','delaware'),('Florida','florida'),('Georgia','georgia'),('Hawaii','hawaii'),
  ('Idaho','idaho'),('Illinois','illinois'),('Indiana','indiana'),('Iowa','iowa'),
  ('Kansas','kansas'),('Kentucky','kentucky'),('Louisiana','louisiana'),('Maine','maine'),
  ('Maryland','maryland'),('Massachusetts','massachusetts'),('Michigan','michigan'),
  ('Minnesota','minnesota'),('Mississippi','mississippi'),('Missouri','missouri'),
  ('Montana','montana'),('Nebraska','nebraska'),('Nevada','nevada'),
  ('New Hampshire','new-hampshire'),('New Jersey','new-jersey'),('New Mexico','new-mexico'),
  ('New York','new-york'),('North Carolina','north-carolina'),('North Dakota','north-dakota'),
  ('Ohio','ohio'),('Oklahoma','oklahoma'),('Oregon','oregon'),('Pennsylvania','pennsylvania'),
  ('Rhode Island','rhode-island'),('South Carolina','south-carolina'),('South Dakota','south-dakota'),
  ('Tennessee','tennessee'),('Texas','texas'),('Utah','utah'),('Vermont','vermont'),
  ('Virginia','virginia'),('Washington','washington'),('West Virginia','west-virginia'),
  ('Wisconsin','wisconsin'),('Wyoming','wyoming'),('District of Columbia','district-of-columbia')
)
SELECT DISTINCT ON (c.id)
  c.id        AS court_id,
  c.full_name AS court_name,
  s.name      AS state,
  s.slug      AS state_slug,
  CASE WHEN cc.jurisdiction = 'S' THEN 'supreme' ELSE 'appeals' END AS court_level,
  -- court_slug: strip the state name + trailing "of (the state) of" filler, then slugify
  juri_slug(
    regexp_replace(
      regexp_replace(c.full_name, '(?i)\y' || s.name || '\y', '', 'g'),
      '(?i)(\s+of\s+the\s+state)?\s+of(\s+the)?\s*$', ''
    )
  ) AS court_slug
FROM (SELECT court_id, max(jurisdiction) AS jurisdiction
      FROM cluster_outcome WHERE jurisdiction IN ('S','SA','SS') GROUP BY court_id) cc
JOIN search_court c ON c.id = cc.court_id
JOIN states s ON c.full_name ~* ('\y' || s.name || '\y')
ORDER BY c.id, length(s.name) DESC;

-- 2. Page rows (scope='state_court', layer='state'). Metric = reversal rate
--    among decided (affirmed+reversed); remand rate over all cases.
INSERT INTO stat_page (
  slug, scope, layer, court_id, court_name, total_cases,
  state, state_slug, court_level, decided_cases, reversal_pct, remand_pct
)
SELECT
  '/outcomes/states/' || m.state_slug || '/' || m.court_slug AS slug,
  'state_court'::text AS scope,
  'state'::text       AS layer,
  m.court_id,
  m.court_name,
  count(*)            AS total_cases,
  m.state, m.state_slug, m.court_level,
  count(*) FILTER (WHERE o.outcome IN ('affirmed','reversed')) AS decided_cases,
  CASE WHEN count(*) FILTER (WHERE o.outcome IN ('affirmed','reversed')) >= 30
       THEN round(100.0 * count(*) FILTER (WHERE o.outcome='reversed')
            / NULLIF(count(*) FILTER (WHERE o.outcome IN ('affirmed','reversed')),0), 1)
  END AS reversal_pct,
  round(100.0 * count(*) FILTER (WHERE o.remanded) / NULLIF(count(*),0), 1) AS remand_pct
FROM cluster_outcome o
JOIN state_court_map m ON m.court_id = o.court_id
GROUP BY m.state_slug, m.court_slug, m.court_id, m.court_name, m.state, m.court_level
HAVING count(*) >= 25;  -- quality floor (same as federal court×case-type)

-- 3. Outcome distribution per court page (reuse the generic stat_outcome table).
INSERT INTO stat_outcome (slug, outcome, n)
SELECT '/outcomes/states/' || m.state_slug || '/' || m.court_slug AS slug,
       o.outcome, count(*)
FROM cluster_outcome o
JOIN state_court_map m ON m.court_id = o.court_id
WHERE o.outcome IS NOT NULL
  AND EXISTS (SELECT 1 FROM stat_page p
              WHERE p.slug = '/outcomes/states/' || m.state_slug || '/' || m.court_slug)
GROUP BY m.state_slug, m.court_slug, o.outcome;

ANALYZE stat_page;
ANALYZE stat_outcome;
