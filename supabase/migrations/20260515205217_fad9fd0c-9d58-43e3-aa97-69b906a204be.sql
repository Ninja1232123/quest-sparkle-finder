CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.search_documents_fts(
  p_query  text,
  p_source text    DEFAULT NULL,
  p_limit  integer DEFAULT 40
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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', p_query) AS tsq
  ),
  ranked AS MATERIALIZED (
    SELECT
      d.id,
      ts_rank_cd(d.search_tsv, q.tsq) AS rank
    FROM public.documents d
    CROSS JOIN q
    WHERE d.search_tsv @@ q.tsq
      AND (p_source IS NULL OR d.source_code = p_source)
    ORDER BY rank DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  SELECT
    d.identifier,
    d.source_code,
    d.parent_label,
    d.section_label,
    d.heading,
    ts_headline(
      'english',
      d.body_text,
      q.tsq,
      'MaxFragments=2,MaxWords=32,MinWords=10,StartSel=<mark>,StopSel=</mark>,HighlightAll=false'
    ) AS snippet,
    ranked.rank::real AS rank
  FROM ranked
  JOIN public.documents d ON d.id = ranked.id
  CROSS JOIN q
  ORDER BY ranked.rank DESC;
$$;

GRANT EXECUTE ON FUNCTION public.search_documents_fts(text, text, integer)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.search_documents_trgm(
  p_query  text,
  p_source text    DEFAULT NULL,
  p_limit  integer DEFAULT 20
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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    d.identifier,
    d.source_code,
    d.parent_label,
    d.section_label,
    d.heading,
    coalesce(d.section_label, '') || ' ' || coalesce(d.heading, '') AS snippet,
    similarity(
      coalesce(d.heading, '') || ' ' || coalesce(d.identifier, ''),
      p_query
    ) AS rank
  FROM public.documents d
  WHERE (
    coalesce(d.heading, '') || ' ' || coalesce(d.identifier, '')
  ) % p_query
    AND (p_source IS NULL OR d.source_code = p_source)
  ORDER BY rank DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.search_documents_trgm(text, text, integer)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.search_hybrid(
  p_query_text      text,
  p_query_embedding vector(1536) DEFAULT NULL,
  p_source          text         DEFAULT NULL,
  p_limit           integer      DEFAULT 20
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
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_tsq tsquery;
BEGIN
  v_tsq := websearch_to_tsquery('english', p_query_text);

  RETURN QUERY
  WITH
  fts_scored AS MATERIALIZED (
    SELECT d.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(d.search_tsv, v_tsq) DESC
      ) AS rn
    FROM public.documents d
    WHERE d.search_tsv @@ v_tsq
      AND (p_source IS NULL OR d.source_code = p_source)
    ORDER BY ts_rank_cd(d.search_tsv, v_tsq) DESC
    LIMIT 60
  ),
  sem_scored AS MATERIALIZED (
    SELECT d.id,
      ROW_NUMBER() OVER (
        ORDER BY d.embedding <=> p_query_embedding
      ) AS rn
    FROM public.documents d
    WHERE p_query_embedding IS NOT NULL
      AND d.embedding IS NOT NULL
      AND (p_source IS NULL OR d.source_code = p_source)
    ORDER BY d.embedding <=> p_query_embedding
    LIMIT 60
  ),
  rrf AS (
    SELECT id, SUM(1.0 / (60.0 + rn)) AS score
    FROM (
      SELECT id, rn FROM fts_scored
      UNION ALL
      SELECT id, rn FROM sem_scored
    ) arms
    GROUP BY id
  ),
  top AS MATERIALIZED (
    SELECT d.id, r.score
    FROM rrf r
    JOIN public.documents d ON d.id = r.id
    ORDER BY r.score DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  SELECT
    d.identifier,
    d.source_code,
    d.parent_label,
    d.section_label,
    d.heading,
    ts_headline(
      'english',
      d.body_text,
      v_tsq,
      'MaxFragments=2,MaxWords=32,MinWords=10,StartSel=<mark>,StopSel=</mark>,HighlightAll=false'
    ) AS snippet,
    top.score::real AS rank
  FROM top
  JOIN public.documents d ON d.id = top.id
  ORDER BY top.score DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_hybrid(text, vector(1536), text, integer)
  TO anon, authenticated, service_role;

RESET search_path;