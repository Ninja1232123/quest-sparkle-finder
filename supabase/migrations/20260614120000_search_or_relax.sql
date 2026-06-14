-- Search relax: keep AND precision, but fall back to OR when AND finds nothing.
--
-- websearch_to_tsquery ANDs every term, so a long natural-language query
-- ("debt collector definition 15 USC 1692") requires ONE document containing
-- every term and usually returns zero — even when the section plainly exists.
-- This rewrite tries the precise AND query first (best for expert keyword
-- searches); only if that matches nothing does it relax to an OR of the same
-- lexemes, ranked by ts_rank_cd so the documents hitting the most / most
-- important terms float to the top. Precise queries are unchanged; casual or
-- verbose queries now return ranked results instead of an empty page.
--
-- Apply to the self_law (corpus) database.

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
  WITH raw AS (
    SELECT websearch_to_tsquery('english', p_query) AS tsq_and
  ),
  q AS (
    SELECT
      tsq_and,
      -- Relaxed form: turn the top-level ANDs into ORs. Phrase (<->) and
      -- exclusion (!) operators are preserved; only '&' is swapped.
      NULLIF(replace(tsq_and::text, '&', '|'), '')::tsquery AS tsq_or
    FROM raw
  ),
  pick AS (
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.documents d, q
          WHERE d.search_tsv @@ q.tsq_and
            AND (p_source IS NULL OR d.source_code = p_source)
        )
        THEN (SELECT tsq_and FROM q)
        ELSE (SELECT tsq_or FROM q)
      END AS tsq
  ),
  ranked AS MATERIALIZED (
    SELECT
      d.id,
      ts_rank_cd(d.search_tsv, p.tsq) AS rank
    FROM public.documents d
    CROSS JOIN pick p
    WHERE p.tsq IS NOT NULL
      AND d.search_tsv @@ p.tsq
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
      p.tsq,
      'MaxFragments=2,MaxWords=32,MinWords=10,StartSel=<mark>,StopSel=</mark>,HighlightAll=false'
    ) AS snippet,
    ranked.rank::real AS rank
  FROM ranked
  JOIN public.documents d ON d.id = ranked.id
  CROSS JOIN pick p
  ORDER BY ranked.rank DESC;
$$;

GRANT EXECUTE ON FUNCTION public.search_documents_fts(text, text, integer)
  TO anon, authenticated, service_role;

RESET search_path;
