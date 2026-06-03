-- State / appellate outcome classifier
-- ------------------------------------------------------------------
-- Turns search_opinioncluster.disposition (free text, OCR-noisy) into a
-- unified outcome enum, so state appellate + supreme cases get base rates
-- the way the federal IDB layer already does. Rules-only (no LLM): proven
-- ~95.5% coverage on the 425k clusters that carry a disposition (overwhelmingly
-- State Supreme `S` 215k + State Appellate `SA` 134k; rest fed appellate/tax).
--
-- Outcome enum (appellate axis primary, trial/tax axes folded in):
--   affirmed reversed mixed remanded vacated modified dismissed
--   denied granted transferred settled plaintiff_win defendant_win other
-- A separate `remanded` boolean is kept alongside `outcome` because
-- "reversed and remanded" classifies as reversed but the remand is its own
-- signal for appellate base rates (reversal rate vs remand rate).
--
-- Run:  psql "$COURTLISTENER_URI" -f scripts/state-outcome-classifier.sql
-- ------------------------------------------------------------------

-- 1. Normalize: lowercase, strip everything but letters/spaces, collapse runs.
CREATE OR REPLACE FUNCTION juri_norm_disposition(t text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT regexp_replace(regexp_replace(lower(coalesce(t,'')), '[^a-z ]', ' ', 'g'), '\s+', ' ', 'g')
$$;

-- 2. Classify normalized disposition into the outcome enum. Order = precedence.
CREATE OR REPLACE FUNCTION juri_classify_disposition(raw text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN d = '' THEN NULL
    -- explicit split outcome wins over either direction
    WHEN d ~ 'in part' THEN 'mixed'
    -- reversed (incl. reversed-and-remanded, reversed-and-rendered, OCR dust)
    WHEN d ~ '(revers|rever|render|reveb|reveis|[bhkle]eversed|be versed)' THEN 'reversed'
    WHEN d ~ 'vacat' THEN 'vacated'
    WHEN d ~ 'remand' THEN 'remanded'
    -- affirmed (incl. "no error" and the heavy OCR variant cloud)
    WHEN d ~ '(affirm|no error|aee[a-z][a-z]?med|app?irmed|a[fp]firmed|affi[eb]med|arrirmed|a firmed|affim|affrim)' THEN 'affirmed'
    WHEN d ~ 'modif' THEN 'modified'
    -- US Tax Court: respondent = Commissioner/IRS, petitioner = taxpayer
    WHEN d ~ 'enter' AND d ~ '(for the respondent|for respondent)' THEN 'defendant_win'
    WHEN d ~ 'enter' AND d ~ '(for the petitioner|for petitioner)' THEN 'plaintiff_win'
    WHEN d ~ 'enter' AND d ~ '(under rule|appropriate (order|decision)|stipul)' THEN 'settled'
    -- old trial verdicts / decrees
    WHEN d ~ '(judgment|decree) for (the )?(plaintiff|complainant|libelant|petitioner)' THEN 'plaintiff_win'
    WHEN d ~ '(judgment|decree) for (the )?(defendant|respondent)' THEN 'defendant_win'
    WHEN d ~ '(dismiss|dismis|withdrawn|quashed)' THEN 'dismissed'
    WHEN d ~ 'denied' THEN 'denied'
    WHEN d ~ 'granted' THEN 'granted'
    WHEN d ~ 'transferr' THEN 'transferred'
    ELSE 'other'
  END
  FROM (SELECT juri_norm_disposition(raw) AS d) s
$$;

-- 3. Materialize cluster -> outcome. Joins court so each row carries the
--    authority/jurisdiction signal needed for base-rate slicing.
DROP TABLE IF EXISTS cluster_outcome;
CREATE TABLE cluster_outcome AS
SELECT
  oc.id                              AS cluster_id,
  oc.docket_id,
  d.court_id,
  c.jurisdiction,
  oc.precedential_status,
  oc.date_filed,
  juri_classify_disposition(oc.disposition)        AS outcome,
  juri_norm_disposition(oc.disposition) ~ 'remand'  AS remanded,
  oc.disposition                     AS raw_disposition
FROM search_opinioncluster oc
JOIN search_docket d ON oc.docket_id = d.id
JOIN search_court  c ON d.court_id  = c.id
WHERE oc.disposition <> '';

ALTER TABLE cluster_outcome ADD PRIMARY KEY (cluster_id);
CREATE INDEX cluster_outcome_juris_idx   ON cluster_outcome (jurisdiction, outcome);
CREATE INDEX cluster_outcome_court_idx   ON cluster_outcome (court_id, outcome);
CREATE INDEX cluster_outcome_outcome_idx ON cluster_outcome (outcome);

ANALYZE cluster_outcome;
