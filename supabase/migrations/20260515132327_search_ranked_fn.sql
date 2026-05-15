-- Upgrade search quality: weighted tsvector, ts_headline snippets, ts_rank_cd ranking.
--
-- Apply with: supabase db push
-- Then update searchDocuments in documents.functions.ts to call the new RPC instead
-- of the inline textSearch + JS ranking path.

-- Step 1: Rebuild search_tsv with four weight levels so ts_rank_cd can distinguish
-- heading (A) > section_label (B) > identifier (C) > body_text (D).
-- Postgres rebuilds the generated column automatically on ALTER; no manual VACUUM needed.
ALTER TABLE public.documents DROP COLUMN search_tsv;

ALTER TABLE public.documents ADD COLUMN search_tsv tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(heading, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(section_label, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(identifier, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(body_text, '')), 'D')
) STORED;

CREATE INDEX documents_search_idx ON public.documents USING GIN (search_tsv);

-- Step 2: Create search_documents_ranked RPC.
-- Returns rows ordered by ts_rank_cd DESC with ts_headline snippets.
-- The snippet uses <mark> delimiters for consistent client-side styling.
CREATE OR REPLACE FUNCTION public.search_documents_ranked(
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
      'StartSel=<mark>,StopSel=</mark>,MaxWords=50,MinWords=20,MaxFragments=2,FragmentDelimiter= … '
    ) AS snippet,
    ts_rank_cd(d.search_tsv, websearch_to_tsquery('english', p_query)) AS rank
  FROM public.documents d
  WHERE
    d.search_tsv @@ websearch_to_tsquery('english', p_query)
    AND (p_source IS NULL OR d.source_code = p_source)
  ORDER BY rank DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.search_documents_ranked(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_documents_ranked(text, text, integer) TO service_role;
