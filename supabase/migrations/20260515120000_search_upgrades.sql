-- Enable trigram extension for fuzzy/typo-tolerant fallback search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on the fields used for the ILIKE / similarity fallback.
-- Covers heading, identifier so "habeus" ~ "habeas" and partial acronym matches work.
CREATE INDEX IF NOT EXISTS documents_trgm_idx
  ON public.documents
  USING GIN ((coalesce(heading, '') || ' ' || coalesce(identifier, '')) gin_trgm_ops);

-- Primary FTS search function.
-- Uses websearch_to_tsquery so callers get native phrase/"exclude"/-word/OR support.
-- ts_headline picks the densest match window (no body_text round-trip to Node).
-- ts_rank_cd with inline weighted tsvector (A=heading, B=section_label, D=body)
-- does all ranking in the index, not in JS.
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

-- Trigram similarity fallback — used when the main FTS query returns nothing
-- (short tokens, acronyms, misspellings that the English dictionary stems away).
-- Returns up to p_limit rows ordered by similarity score descending.
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
    -- For trgm hits just surface the heading as context; body_text stays on server.
    coalesce(d.section_label, '') || ' ' || coalesce(d.heading, '') AS snippet,
    similarity(
      coalesce(d.heading, '') || ' ' || coalesce(d.identifier, ''),
      p_query
    )                                                                AS rank
  FROM public.documents d
  WHERE (
    coalesce(d.heading, '') || ' ' || coalesce(d.identifier, '')
  ) % p_query                         -- uses the GIN trgm index
    AND (p_source IS NULL OR d.source_code = p_source)
  ORDER BY rank DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.search_documents_trgm(text, text, integer)
  TO anon, authenticated, service_role;
