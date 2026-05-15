-- Enable trigram extension for fuzzy/typo-tolerant fallback search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS documents_trgm_idx
  ON public.documents
  USING GIN ((coalesce(heading, '') || ' ' || coalesce(identifier, '')) gin_trgm_ops);

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
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.identifier,
    d.source_code,
    d.parent_label,
    d.section_label,
    d.heading,
    ts_headline(
      'english',
      d.body_text,
      websearch_to_tsquery('english', p_query),
      'MaxFragments=2,MaxWords=40,MinWords=15,StartSel=<mark>,StopSel=</mark>,HighlightAll=false'
    )                                                   AS snippet,
    ts_rank_cd(
      setweight(to_tsvector('english', coalesce(d.heading,        '')), 'A') ||
      setweight(to_tsvector('english', coalesce(d.section_label,  '')), 'B') ||
      setweight(to_tsvector('english', coalesce(d.body_text,      '')), 'D'),
      websearch_to_tsquery('english', p_query)
    )                                                   AS rank
  FROM public.documents d
  WHERE d.search_tsv @@ websearch_to_tsquery('english', p_query)
    AND (p_source IS NULL OR d.source_code = p_source)
  ORDER BY rank DESC
  LIMIT p_limit;
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
SECURITY DEFINER
SET search_path = public
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
    )                                                                AS rank
  FROM public.documents d
  WHERE (
    coalesce(d.heading, '') || ' ' || coalesce(d.identifier, '')
  ) % p_query
    AND (p_source IS NULL OR d.source_code = p_source)
  ORDER BY rank DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.search_documents_trgm(text, text, integer)
  TO anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS documents_embedding_hnsw_idx
  ON public.documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tsq tsquery;
BEGIN
  v_tsq := websearch_to_tsquery('english', p_query_text);

  RETURN QUERY
  WITH
  fts_scored AS (
    SELECT d.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(
          setweight(to_tsvector('english', coalesce(d.heading,       '')), 'A') ||
          setweight(to_tsvector('english', coalesce(d.section_label, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(d.body_text,     '')), 'D'),
          v_tsq
        ) DESC
      ) AS rn
    FROM documents d
    WHERE d.search_tsv @@ v_tsq
      AND (p_source IS NULL OR d.source_code = p_source)
    LIMIT 60
  ),
  sem_scored AS (
    SELECT d.id,
      ROW_NUMBER() OVER (
        ORDER BY d.embedding <=> p_query_embedding
      ) AS rn
    FROM documents d
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
  top AS (
    SELECT d.*, r.score
    FROM rrf r
    JOIN documents d ON d.id = r.id
    ORDER BY r.score DESC
    LIMIT p_limit
  )
  SELECT
    t.identifier,
    t.source_code,
    t.parent_label,
    t.section_label,
    t.heading,
    ts_headline(
      'english',
      t.body_text,
      v_tsq,
      'MaxFragments=2,MaxWords=40,MinWords=15,StartSel=<mark>,StopSel=</mark>,HighlightAll=false'
    ) AS snippet,
    t.score::real AS rank
  FROM top t
  ORDER BY t.score DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_hybrid(text, vector(1536), text, integer)
  TO anon, authenticated, service_role;