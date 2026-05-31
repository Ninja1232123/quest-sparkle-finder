-- ============================================================================
-- search-tsv-rerank.sql  —  RUN ON THE HEADLESS BOX (database: self_law)
--     psql -d self_law -f scripts/search-tsv-rerank.sql
--
-- ============================================================================
-- v2 (2026-05-30) — AUTHORITY DAMPING. Supersedes the v1 additive title boost.
-- ============================================================================
-- WHAT v1 GOT WRONG: v1 added a flat title bonus (+3 * ts_rank(title)) on top of
-- the existing rank. But the existing rank is ts_rank_cd(body) * authority, and
-- authority is RAW citation count — §78c "Definitions and application" has
-- authority 12854, while §1692g "Validation of debts" has authority 38. That is
-- a 338x multiplier gap. An additive bonus of at most ~3 cannot move a row past a
-- rank of 1285. Measured result: searching "validation of debts" ranked §1692g
-- (a section LITERALLY TITLED that) at position 14, behind §78c at position 0.
-- The title boost was attacking the wrong term.
--
-- WHAT v2 DOES — three structural changes so RELEVANCE leads and authority only
-- breaks ties:
--   1. DAMP AUTHORITY. Replace the raw multiplier with 1 + AUTH_WEIGHT*ln(1+auth).
--      12854 -> ~4.3x, 38 -> ~2.3x. The 338x gap collapses to ~1.9x — well-cited
--      law still floats up, but it can no longer bury an on-point section.
--   2. MULTIPLICATIVE TITLE. relevance = text * (1 + TITLE_BOOST*title_score).
--      A heading that matches the query lifts the row proportionally instead of
--      adding a rounding error.
--   3. RELEVANCE-BASED PREFILTER. Stage 1 now pulls the top PREFILTER rows by pure
--      ts_rank_cd (NOT text*authority), so a low-authority but perfectly-titled
--      section is guaranteed into the candidate pool before the re-rank.
--
-- No table rewrite, no lock: still a two-stage rank over the precomputed
-- search_tsv column. Idempotent (CREATE OR REPLACE). Preserves the exact
-- signature, return columns, and scope logic of the live function. Safe to re-run.
--
-- TUNING KNOBS:
--   TITLE_BOOST  (4.0)  — how hard a heading match lifts the row (multiplicative).
--   AUTH_WEIGHT  (0.35) — how much damped authority counts. 0 = pure relevance;
--                         higher = citation count matters more.
--   PREFILTER    (300)  — candidates pulled by pure text rank before the re-rank.
--                         Bigger = safer recall, slightly slower.
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
  v_pre     integer := 300;   -- PREFILTER
BEGIN
  IF v_sources IS NOT NULL THEN
    v_where := 'd.source_code = ANY (' || quote_literal(v_sources::text) || '::text[])';
  END IF;

  RETURN QUERY EXECUTE format($fmt$
    -- Stage 1: prefilter on PURE text relevance (no authority skew), so on-point
    -- low-citation sections always enter the candidate pool.
    WITH base AS MATERIALIZED (
      SELECT d.id, d.heading, d.section_label,
             ts_rank_cd(d.search_tsv, $1)        AS text_rank,
             coalesce(a.authority, 1.0)          AS authority
      FROM public.document_sections d
      LEFT JOIN public.doc_authority a ON a.id = d.id
      WHERE d.search_tsv @@ $1
        AND %s
      ORDER BY text_rank DESC
      LIMIT %s
    ),
    -- Stage 2: re-rank candidates.
    --   relevance = text * (1 + TITLE_BOOST * title_score)   [title is multiplicative]
    --   rank      = relevance * (1 + AUTH_WEIGHT * ln(1+authority))  [authority damped]
    ranked AS (
      SELECT id,
             (
               text_rank
               * (1.0 + 4.0 * ts_rank(                         -- TITLE_BOOST
                   to_tsvector('english',
                     coalesce(heading, '') || ' ' || coalesce(section_label, '')),
                   $1))
             )
             * (1.0 + 0.35 * ln(1.0 + authority))              -- AUTH_WEIGHT, damped
               AS rank
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
-- VERIFY (eyeball: §1692g should now rank at/near the top, ahead of §78c)
-- ============================================================================
\echo
\echo '=== "validation of debts" (expect 15 USC 1692g at/near top, §78c demoted) ==='
SELECT source_code, identifier, left(heading, 48) AS heading, round(rank::numeric, 4) AS rank
FROM public.search_documents_fts('validation of debts', NULL, 8, 'all');
\echo
\echo '=== "debt collector validation notice" ==='
SELECT source_code, identifier, left(heading, 48) AS heading, round(rank::numeric, 4) AS rank
FROM public.search_documents_fts('debt collector validation notice', NULL, 8, 'all');
