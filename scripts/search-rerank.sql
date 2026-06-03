-- Search rerank: federate the candidate prefilter per source, rank heading-first,
-- then RETURN per-source top-K (not a global top-N) so small but on-point corpora
-- are never crowded out.
--
-- Old prefilter took the global top-300 by raw text rank, so sources with
-- thousands of weak matches (CFR 9.6k, USC 8.1k for "contracts") filled every
-- slot and a source that *is* the law on point but small (UCC 173, IRM 573)
-- never entered ranking. And the authority multiplier (0.35*ln) ran ~5x for USC
-- vs ~1.1x for states (authority 0), burying primary state law.
--
-- The frontend already groups results by source and shows the top ~5 per group
-- with a "+N more" link. But because the RPC returned a *global* top-40, a small
-- corpus that matched (the Constitution on "due process") could fail to place a
-- single row in that 40 and vanish entirely. The fix is to federate the OUTPUT
-- too: take top-K per source, order the source groups by each source's strongest
-- hit, and cap the number of groups so a broad ('all') scope doesn't explode.
--
-- New shape:
--   1. Resolve scope -> concrete source list ('all' -> every source via a cheap
--      loose index skip-scan).
--   2. For EACH source pull its top p_per_source candidates (bounded top-N per
--      source -> no source can crowd the others out of the *ranking* pool).
--   3. Re-rank the union with a HEADING-WEIGHTED vector (heading=A, body=D) so a
--      section literally titled about the term wins over body keyword-saturation;
--      authority is a gentle tiebreaker (0.12*ln).
--   4. FEDERATE THE OUTPUT: keep top p_display_per_source rows per source, order
--      source groups by their best hit, keep at most p_max_sources groups.
--
-- After deploying, flush the result cache so stale global-ranked hits aren't
-- served:  TRUNCATE public.search_cache;  (included at the bottom.)

-- Old signatures must go or PostgREST can't disambiguate the new defaulted args.
DROP FUNCTION IF EXISTS public.search_documents_fts(text, text, integer, text, integer);
DROP FUNCTION IF EXISTS public.search_documents_fts(text, text, integer, text);
DROP FUNCTION IF EXISTS public.search_documents_fts(text, text, integer);

CREATE OR REPLACE FUNCTION public.search_documents_fts(
  p_query text,
  p_source text DEFAULT NULL,
  p_limit integer DEFAULT 120,
  p_scope text DEFAULT 'codified',
  p_per_source integer DEFAULT 30,
  p_display_per_source integer DEFAULT 6,
  p_max_sources integer DEFAULT 14
)
RETURNS TABLE(identifier text, source_code text, parent_label text,
              section_label text, heading text, snippet text, rank real)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_sources text[] := public._scope_sources(p_scope, p_source);
  v_lim     integer := LEAST(GREATEST(p_limit, 1), 200);
  v_per     integer := LEAST(GREATEST(p_per_source, 5), 100);
  v_disp    integer := LEAST(GREATEST(p_display_per_source, 1), 25);
  -- A single-source filter is a flat list, not a federation: show many rows from
  -- the one source and don't cap groups.
  v_maxsrc  integer := CASE WHEN p_source IS NOT NULL THEN 1
                            ELSE LEAST(GREATEST(p_max_sources, 1), 60) END;
  v_tsq     tsquery := websearch_to_tsquery('english', p_query);
BEGIN
  -- 'all' (NULL) -> the full distinct source list, gathered with a recursive
  -- skip-scan over the (source_code, sort_key) index (cheap; ~60 seeks).
  IF v_sources IS NULL THEN
    WITH RECURSIVE s AS (
      (SELECT ds.source_code AS sc FROM public.document_sections ds ORDER BY ds.source_code LIMIT 1)
      UNION ALL
      SELECT (SELECT ds.source_code FROM public.document_sections ds
              WHERE ds.source_code > s.sc ORDER BY ds.source_code LIMIT 1)
      FROM s WHERE s.sc IS NOT NULL
    )
    SELECT array_agg(s.sc) INTO v_sources FROM s WHERE s.sc IS NOT NULL;
  END IF;

  IF v_sources IS NULL OR array_length(v_sources, 1) IS NULL THEN
    RETURN;  -- empty scope (e.g. 'cases')
  END IF;

  -- A single source: bump per-source display to the whole limit (flat list).
  IF p_source IS NOT NULL THEN
    v_disp := v_lim;
  END IF;

  RETURN QUERY
  -- Stage 1: scan the term matches ONCE, then take top-N per source via a window
  -- (one GIN scan, not one per source). row_number keeps each source's best
  -- candidates so no high-volume source can crowd the others out of the pool.
  WITH matches AS MATERIALIZED (
    SELECT d.id, d.source_code,
           ts_rank_cd(d.search_tsv, v_tsq) AS tr,
           coalesce(a.authority, 1.0) AS authority
    FROM public.document_sections d
    LEFT JOIN public.doc_authority a ON a.id = d.id
    WHERE d.search_tsv @@ v_tsq
      AND d.source_code = ANY (v_sources)
  ),
  cand AS (
    SELECT m.id, m.authority
    FROM (
      SELECT matches.id, matches.authority,
             row_number() OVER (PARTITION BY matches.source_code ORDER BY matches.tr DESC) AS rn
      FROM matches
    ) m
    WHERE m.rn <= v_per
  ),
  -- Stage 2: heading-weighted re-rank over the bounded pool.
  scored AS (
    SELECT c.id, d.source_code,
           ts_rank('{0.1,0.2,0.4,1.0}',
             setweight(to_tsvector('english', coalesce(d.heading,'') || ' ' || coalesce(d.section_label,'')), 'A')
             || setweight(to_tsvector('english', left(coalesce(d.body_text,''), 12000)), 'D'),
             v_tsq)
           * (1.0 + 0.12 * ln(1.0 + c.authority))
             AS rank
    FROM cand c
    JOIN public.document_sections d ON d.id = c.id
  ),
  -- Stage 3: federate the OUTPUT — rank within each source, and rank the sources
  -- by their single best hit, so every matching source is represented and the
  -- most on-point source leads.
  within AS (
    SELECT s.id, s.source_code, s.rank,
           row_number() OVER (PARTITION BY s.source_code ORDER BY s.rank DESC) AS rn,
           max(s.rank)   OVER (PARTITION BY s.source_code) AS src_best
    FROM scored s
  ),
  src_order AS (
    SELECT u.source_code, u.src_best,
           row_number() OVER (ORDER BY u.src_best DESC, u.source_code) AS source_pos
    FROM (SELECT DISTINCT within.source_code, within.src_best FROM within) u
  ),
  kept AS (
    SELECT w.id, w.rank, o.source_pos
    FROM within w
    JOIN src_order o ON o.source_code = w.source_code
    WHERE w.rn <= v_disp
      AND o.source_pos <= v_maxsrc
    ORDER BY o.source_pos, w.rank DESC
    LIMIT v_lim
  )
  SELECT d.identifier, d.source_code, d.parent_label, d.section_label, d.heading,
         ts_headline('english', left(d.body_text, 8000), v_tsq,
           'MaxFragments=2,MaxWords=32,MinWords=10,StartSel=<mark>,StopSel=</mark>,HighlightAll=false'
         ) AS snippet,
         k.rank::real
  FROM kept k
  JOIN public.document_sections d ON d.id = k.id
  ORDER BY k.source_pos, k.rank DESC;
END;
$function$;

-- Flush stale global-ranked cache entries so the federated rankings take effect.
TRUNCATE public.search_cache;
