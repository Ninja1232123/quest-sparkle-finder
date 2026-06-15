-- Cheap wide scan: full-text match with NO snippet generation.
--
-- search_documents_fts/bool compute a ts_headline snippet per row — great for
-- reading the matched language, but ts_headline re-parses body_text (the
-- expensive part) and the snippet dominates the token cost of feeding results
-- back to the model. For surveying the landscape that's waste: the model only
-- needs to know WHAT exists and WHERE, then drill into the few cites worth it.
--
-- scan_documents returns lean rows (citation + heading + rank, no snippet) at a
-- high limit, so the model can see many documents for a fraction of the cost,
-- then call search/fetch on only the promising ones. AND-first with an OR-relax
-- fallback so a wide scan never dead-ends. Apply to self_law; reload PostgREST.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.scan_documents(
  p_query  text,
  p_source text    DEFAULT NULL,
  p_limit  integer DEFAULT 25
)
RETURNS TABLE (
  identifier    text,
  source_code   text,
  section_label text,
  heading       text,
  rank          real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tsq tsquery;
  v_or  tsquery;
BEGIN
  v_tsq := websearch_to_tsquery('english', p_query);
  IF v_tsq IS NULL OR v_tsq::text = '' THEN
    RETURN;
  END IF;
  -- AND-first; if strict AND matches nothing, relax & -> | so the wide scan
  -- still returns the neighborhood instead of dead-ending on one rare word.
  v_or := NULLIF(replace(v_tsq::text, '&', '|'), '')::tsquery;
  IF NOT EXISTS (
    SELECT 1 FROM public.document_sections d
    WHERE d.search_tsv @@ v_tsq
      AND (p_source IS NULL OR d.source_code = p_source)
  ) THEN
    v_tsq := COALESCE(v_or, v_tsq);
  END IF;

  RETURN QUERY
  SELECT d.identifier, d.source_code, d.section_label, d.heading,
         ts_rank_cd(d.search_tsv, v_tsq) AS rank
  FROM public.document_sections d
  WHERE d.search_tsv @@ v_tsq
    AND (p_source IS NULL OR d.source_code = p_source)
  ORDER BY rank DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$$;

GRANT EXECUTE ON FUNCTION public.scan_documents(text, text, integer)
  TO anon, service_role;

RESET search_path;

NOTIFY pgrst, 'reload schema';
