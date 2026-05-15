-- Hybrid semantic + full-text search infrastructure.
-- Requires LOVABLE_API_KEY (or any OpenAI-compatible embedding endpoint) to backfill.
-- Dimension is 1536 to match text-embedding-3-small.
-- To use voyage-law-2 (1024 dims) instead, change vector(1536) → vector(1024) and
-- drop/recreate this column + the index, then re-run the backfill.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- HNSW index for approximate nearest-neighbour search (cosine distance).
-- Build runs once; subsequent inserts update it incrementally.
CREATE INDEX IF NOT EXISTS documents_embedding_hnsw_idx
  ON public.documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Partial index hint: only index rows that have an embedding to avoid wasting
-- index space on unembedded rows (common during initial backfill).
-- (The HNSW index above already skips NULLs, but this makes the intent explicit.)

-- Hybrid search: Reciprocal Rank Fusion over FTS + semantic results.
-- p_query_text  – raw user query (also used for websearch_to_tsquery + ts_headline)
-- p_query_embedding – query vector from embedding API (NULL → FTS-only, safe)
-- p_source      – optional source_code filter
-- p_limit       – max rows returned
--
-- Scoring: score = Σ 1/(60 + rank_i) for each list the document appears in.
-- k=60 is the standard RRF constant; no normalization needed.
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
  -- ── FTS arm ─────────────────────────────────────────────────────────────
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
  -- ── Semantic arm (skipped entirely when embedding is null) ───────────────
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
  -- ── RRF fusion ──────────────────────────────────────────────────────────
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
    -- ts_headline falls back to beginning of text when no FTS match (semantic-only hits).
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
