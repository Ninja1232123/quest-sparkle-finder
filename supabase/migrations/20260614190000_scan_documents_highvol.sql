-- Raise scan_documents to high-volume retrieval.
--
-- The point of scan is to grab a LOT of matching results cheaply (lean rows, no
-- bodies) and hand the whole field to the model + the user's browser at once —
-- the corpus is 4M+ sections, so a real sweep wants hundreds of hits, not 8.
-- websearch_to_tsquery already parses the AND/OR/phrase/-exclude operators
-- inline, so this stays one lean call. Only the LIMIT ceiling changes (100 ->
-- 500). Apply to self_law; reload PostgREST.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.scan_documents(
  p_query  text,
  p_source text    DEFAULT NULL,
  p_limit  integer DEFAULT 80
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
  LIMIT LEAST(GREATEST(p_limit, 1), 500);
END;
$$;

GRANT EXECUTE ON FUNCTION public.scan_documents(text, text, integer)
  TO anon, service_role;

RESET search_path;

NOTIFY pgrst, 'reload schema';
