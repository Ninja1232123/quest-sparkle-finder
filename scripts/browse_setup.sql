-- ============================================================================
-- browse_setup.sql
--
-- Phase two of the corpus wiring: BROWSE + DISCOVERY.
--
-- corpus_db_setup.sql made the corpus *searchable* (FTS / trigram / TOC).
-- This script makes every source *discoverable and browseable* by the site:
--
--   1. list_sources()        — counts per source_code, so the nav/grid can be
--                              built from the data instead of a hardcoded list.
--   2. register_years()      — Federal Register: year buckets.
--      register_days(year)   — Federal Register: day (issue) buckets in a year.
--   3. bill_congresses()     — Congressional Bills: Congress buckets.
--      bill_list(...)        — bills within a Congress, grouped + paginated.
--
-- WHY THE LAST FOUR EXIST
--   `register` (650K rows) and `bill` (835K) are firehoses. Their parent_label
--   TOC has 300K+ / 250K+ distinct entries — far too many for the one-page
--   source_toc() drill-down. These functions facet them by the already-indexed
--   `sort_key` (document_sections_source_sort_idx), so each drill is an index
--   range scan, not a full-table aggregate.
--
--   sort_key layout:
--     register : 'YYYYMMDD.docnum'        e.g. '20000118.00-1000'
--     bill     : 'CONG.TT.NNNNNN.SSSSS'   e.g. '0113.01.000001.00001'
--
-- Idempotent (CREATE OR REPLACE), reads only, never writes corpus rows.
-- Run on the box as a superuser:  psql -d self_law -f scripts/browse_setup.sql
-- ============================================================================

\set ON_ERROR_STOP on

-- ----------------------------------------------------------------------------
-- 1. list_sources() — one cheap grouped count for the whole corpus.
--    Feeds the /code grid, every source dropdown, and per-codebook counts.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_sources()
RETURNS TABLE (source_code text, doc_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT source_code, count(*)::bigint AS doc_count
  FROM public.document_sections
  WHERE source_code IS NOT NULL
  GROUP BY source_code
  ORDER BY source_code;
$$;

-- ----------------------------------------------------------------------------
-- 2. Federal Register — date hierarchy.
-- ----------------------------------------------------------------------------

-- 2a. Year buckets: left(sort_key,4). Index-only over the register slice.
CREATE OR REPLACE FUNCTION public.register_years()
RETURNS TABLE (bucket text, n bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT left(sort_key, 4) AS bucket, count(*)::bigint AS n
  FROM public.document_sections
  WHERE source_code = 'register' AND sort_key IS NOT NULL
  GROUP BY 1
  ORDER BY 1;
$$;

-- 2b. Day (issue) buckets within one year: left(sort_key,8) = 'YYYYMMDD'.
--     Range bound on sort_key keeps this an index range scan over the year.
CREATE OR REPLACE FUNCTION public.register_days(p_year text)
RETURNS TABLE (bucket text, n bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT left(sort_key, 8) AS bucket, count(*)::bigint AS n
  FROM public.document_sections
  WHERE source_code = 'register'
    AND sort_key >= p_year
    AND sort_key <  (p_year::int + 1)::text
  GROUP BY 1
  ORDER BY 1;
$$;

-- ----------------------------------------------------------------------------
-- 3. Congressional Bills — Congress -> bill drill-down.
-- ----------------------------------------------------------------------------

-- 3a. Congress buckets: the first dot-segment of sort_key ('0113', '0114', ...).
CREATE OR REPLACE FUNCTION public.bill_congresses()
RETURNS TABLE (bucket text, n bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT split_part(sort_key, '.', 1) AS bucket, count(*)::bigint AS n
  FROM public.document_sections
  WHERE source_code = 'bill' AND sort_key IS NOT NULL
  GROUP BY 1
  ORDER BY 1;
$$;

-- 3b. Bills within a Congress, grouped to one row per bill-version.
--     bill_key = 'CONG.TT.NNNNNN' (sort_key minus the per-section suffix).
--     label    = parent_label up to ' — ' ("113th Congress · H.R. 1 (Introduced in House)")
--     title    = bill title after ' — ' (sections carry it; preamble may not)
--     Optional p_q does a case-insensitive contains on parent_label (matches a
--     bill number like "H.R. 1" or any words in the title). Paginated.
CREATE OR REPLACE FUNCTION public.bill_list(
  p_congress text,
  p_q        text    DEFAULT NULL,
  p_limit    integer DEFAULT 60,
  p_offset   integer DEFAULT 0
)
RETURNS TABLE (
  bill_key         text,
  label            text,
  title            text,
  n                bigint,
  first_identifier text,
  sort_lo          text,
  sort_hi          text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
  WITH slice AS (
    SELECT
      split_part(sort_key, '.', 1) || '.' ||
      split_part(sort_key, '.', 2) || '.' ||
      split_part(sort_key, '.', 3)                       AS bill_key,
      split_part(parent_label, ' — ', 1)                 AS label,
      NULLIF(split_part(parent_label, ' — ', 2), '')     AS title,
      sort_key,
      identifier
    FROM public.document_sections
    WHERE source_code = 'bill'
      AND sort_key >= p_congress
      AND sort_key <  lpad((p_congress::int + 1)::text, 4, '0')
      AND (p_q IS NULL OR parent_label ILIKE '%' || p_q || '%')
  )
  SELECT
    bill_key,
    min(label)                          AS label,
    max(title)                          AS title,
    count(*)::bigint                    AS n,
    (array_agg(identifier ORDER BY sort_key))[1] AS first_identifier,
    min(sort_key)                       AS sort_lo,
    max(sort_key)                       AS sort_hi
  FROM slice
  GROUP BY bill_key
  ORDER BY min(sort_key)
  LIMIT  LEAST(GREATEST(p_limit, 1), 200)
  OFFSET GREATEST(p_offset, 0);
$$;

-- ----------------------------------------------------------------------------
-- 4. GRANTS — the site connects through PostgREST as the read-only `anon` role.
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.list_sources()                                TO anon;
GRANT EXECUTE ON FUNCTION public.register_years()                              TO anon;
GRANT EXECUTE ON FUNCTION public.register_days(text)                           TO anon;
GRANT EXECUTE ON FUNCTION public.bill_congresses()                             TO anon;
GRANT EXECUTE ON FUNCTION public.bill_list(text, text, integer, integer)       TO anon;

-- ----------------------------------------------------------------------------
-- 5. VERIFICATION (prints only)
-- ----------------------------------------------------------------------------
\echo
\echo '=== browse_setup complete — verification ==='
SELECT 'sources' AS check, count(*)::text AS value FROM public.list_sources()
UNION ALL SELECT 'register years',   count(*)::text FROM public.register_years()
UNION ALL SELECT 'bill congresses',  count(*)::text FROM public.bill_congresses();
