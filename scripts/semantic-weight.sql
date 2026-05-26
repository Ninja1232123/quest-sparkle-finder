-- ============================================================================
-- semantic-weight.sql
--
-- Adds a `p_semantic_weight` (0..1) knob to search_hybrid so the UI's
-- keyword <-> meaning slider actually blends the two arms, instead of the
-- fixed 50/50 Reciprocal Rank Fusion. Supersedes the search_hybrid in
-- semantic-search-setup.sql.
--
--   w = 0.0  -> pure keyword (vector arm contributes 0)
--   w = 0.5  -> identical to the original RRF (both arms equal)
--   w = 1.0  -> pure semantic
--
-- The 4-arg signature is dropped first so PostgREST doesn't see two overloads.
-- Idempotent. Run on the box:  psql -d self_law -f scripts/semantic-weight.sql
-- ============================================================================
\set ON_ERROR_STOP on

DROP FUNCTION IF EXISTS public.search_hybrid(text, vector, text, integer);

CREATE OR REPLACE FUNCTION public.search_hybrid(
  p_query_text      text,
  p_query_embedding vector           DEFAULT NULL,
  p_source          text             DEFAULT NULL,
  p_limit           integer          DEFAULT 20,
  p_semantic_weight double precision DEFAULT 0.5
)
RETURNS TABLE (
  identifier text, source_code text, parent_label text,
  section_label text, heading text, snippet text, rank real
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'pg_temp'
SET hnsw.ef_search TO '500'
AS $function$
DECLARE
  v_tsq tsquery;
  w     double precision := GREATEST(0.0, LEAST(1.0, p_semantic_weight));
BEGIN
  v_tsq := websearch_to_tsquery('english', p_query_text);

  RETURN QUERY
  WITH
  fts_scored AS MATERIALIZED (
    SELECT d.id,
           ROW_NUMBER() OVER (ORDER BY ts_rank_cd(d.search_tsv, v_tsq) DESC) AS rn
    FROM public.document_sections d
    WHERE d.search_tsv @@ v_tsq
      AND (p_source IS NULL OR d.source_code = p_source)
    ORDER BY ts_rank_cd(d.search_tsv, v_tsq) DESC
    LIMIT 60
  ),
  sem_chunks AS MATERIALIZED (
    SELECT ft.source_id::int                 AS doc_id,
           ft.embedding <=> p_query_embedding AS dist
    FROM public.fast_text ft
    WHERE p_query_embedding IS NOT NULL
    ORDER BY ft.embedding <=> p_query_embedding
    LIMIT 400
  ),
  sem_scored AS MATERIALIZED (
    SELECT doc_id, ROW_NUMBER() OVER (ORDER BY min(dist)) AS rn
    FROM sem_chunks
    GROUP BY doc_id
    ORDER BY min(dist)
    LIMIT 60
  ),
  -- Weighted RRF: keyword arm scaled by (1-w), semantic arm by w.
  rrf AS (
    SELECT id, SUM(weight * 1.0 / (60.0 + rn)) AS score
    FROM (
      SELECT id,     (1.0 - w) AS weight, rn FROM fts_scored
      UNION ALL
      SELECT doc_id, w         AS weight, rn FROM sem_scored
    ) arms
    GROUP BY id
  ),
  top AS MATERIALIZED (
    SELECT r.id, r.score
    FROM rrf r
    JOIN public.document_sections d ON d.id = r.id
    WHERE (p_source IS NULL OR d.source_code = p_source)
    ORDER BY r.score DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  SELECT
    d.identifier, d.source_code, d.parent_label, d.section_label, d.heading,
    ts_headline('english', d.body_text, v_tsq,
      'MaxFragments=2,MaxWords=32,MinWords=10,StartSel=<mark>,StopSel=</mark>,HighlightAll=false') AS snippet,
    top.score::real AS rank
  FROM top
  JOIN public.document_sections d ON d.id = top.id
  ORDER BY top.score DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.search_hybrid(text, vector, text, integer, double precision) TO anon;
NOTIFY pgrst, 'reload schema';
