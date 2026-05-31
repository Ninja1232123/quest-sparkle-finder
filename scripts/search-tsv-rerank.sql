-- ============================================================================
-- search-tsv-rerank.sql  —  RUN ON THE HEADLESS BOX (database: self_law)
--     psql -d self_law -f scripts/search-tsv-rerank.sql
--
-- THE PROBLEM (diagnosed 2026-05-30): search ranks by ts_rank_cd(search_tsv)
-- alone. search_tsv includes the heading, but with the SAME weight as body —
-- so a section literally TITLED what you searched ("Validation of debts",
-- §1692g) gets buried under long sections that merely mention the terms in
-- passing. Searching "validation of debts" didn't surface §1692g near the top;
-- "fair debt collection practices" returned a tax-confidentiality section.
--
-- THE FIX: add a TITLE boost to the rank. A match in the heading/section_label
-- is worth far more than an incidental body match. We do it WITHOUT rewriting
-- the 1.86M-row search_tsv column (no table rewrite, no lock): a two-stage
-- rank — cheap prefilter on the precomputed column, then re-rank the top
-- candidates with a title score computed on just those rows.
--
-- Idempotent (CREATE OR REPLACE). Preserves the exact signature, columns,
-- authority weighting, and scope logic of the live function. Safe to re-run.
--
-- TUNING KNOBS:
--   TITLE_BOOST  (3.0) — how hard a heading match outranks a body match. Raise
--                        if titles still lose; lower if junk titles float up.
--   PREFILTER    (200) — candidates pulled by the fast body rank before the
--                        title re-rank. Bigger = safer recall, slightly slower.
-- ============================================================================

\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION public.search_documents_fts(
  p_query  text,
  p_source text    DEFAULT NULL,
  p_limit  integer DEFAULT 40,
  p_scope  text    DEFAULT 'codified'
)
RETURNS TABLE (
  identifier    text,
  source_code   text,
  parent_label  text,
  section_label text,
  heading       text,
  snippet       text,
  rank          real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sources text[] := public._scope_sources(p_scope, p_source);
  v_where   text   := 'true';
  v_lim     integer := LEAST(GREATEST(p_limit, 1), 100);
  v_pre     integer := 200;   -- PREFILTER
BEGIN
  IF v_sources IS NOT NULL THEN
    v_where := 'd.source_code = ANY (' || quote_literal(v_sources::text) || '::text[])';
  END IF;

  RETURN QUERY EXECUTE format($fmt$
    -- Stage 1: fast prefilter on the precomputed search_tsv (× authority).
    WITH base AS MATERIALIZED (
      SELECT d.id, d.heading, d.section_label,
             ts_rank_cd(d.search_tsv, $1) * coalesce(a.authority, 1.0) AS body_rank
      FROM public.document_sections d
      LEFT JOIN public.doc_authority a ON a.id = d.id
      WHERE d.search_tsv @@ $1
        AND %s
      ORDER BY body_rank DESC
      LIMIT %s
    ),
    -- Stage 2: re-rank just those candidates, adding a TITLE boost. Computing
    -- to_tsvector over the (short) heading is cheap on ~200 rows.
    ranked AS (
      SELECT id,
             body_rank
             + 3.0 * ts_rank(
                 to_tsvector('english',
                   coalesce(heading, '') || ' ' || coalesce(section_label, '')),
                 $1)                                  AS rank   -- TITLE_BOOST
      FROM base
      ORDER BY rank DESC
      LIMIT %s
    )
    SELECT d.identifier, d.source_code, d.parent_label, d.section_label, d.heading,
           ts_headline('english', left(d.body_text, 8000), $1,
             'MaxFragments=2,MaxWords=32,MinWords=10,StartSel=<mark>,StopSel=</mark>,HighlightAll=false'
           ) AS snippet,
           ranked.rank::real
    FROM ranked
    JOIN public.document_sections d ON d.id = ranked.id
    ORDER BY ranked.rank DESC
  $fmt$, v_where, v_pre, v_lim)
  USING websearch_to_tsquery('english', p_query);
END;
$$;

-- ============================================================================
-- VERIFY (eyeball: §1692g should now rank at/near the top for both)
-- ============================================================================
\echo
\echo '=== "validation of debts" (expect 15 USC 1692g high) ==='
SELECT source_code, identifier, left(heading, 48) AS heading, round(rank::numeric, 4) AS rank
FROM public.search_documents_fts('validation of debts', NULL, 5, 'all');
\echo
\echo '=== "debt collector validation notice" ==='
SELECT source_code, identifier, left(heading, 48) AS heading, round(rank::numeric, 4) AS rank
FROM public.search_documents_fts('debt collector validation notice', NULL, 5, 'all');
