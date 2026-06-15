-- Cheap citation-graph hop: follow the edges without reading the documents.
--
-- A single section can cite dozens of others (and be cited by dozens more);
-- real research has to walk that graph several steps out, not stop at the first
-- ring. Reading each document just to discover what it cites is the expensive
-- way. citation_edges already holds 8.7M resolved edges, so this returns a
-- document's citations as lean rows (cite + target identifier + heading) — the
-- model follows the promising ones and only fetches full text at the leaves.
--
--   direction 'out' = the authorities THIS section cites
--   direction 'in'  = the sections that cite THIS one (who relies on it)
--
-- Apply to self_law; reload PostgREST.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.document_citations(
  p_identifier text,
  p_direction  text    DEFAULT 'out',
  p_limit      integer DEFAULT 60
)
RETURNS TABLE (
  cite        text,
  identifier  text,
  heading     text,
  target_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  SELECT d.id INTO v_id FROM public.document_sections d
   WHERE d.identifier = p_identifier LIMIT 1;
  IF v_id IS NULL THEN
    RETURN;
  END IF;

  IF p_direction = 'in' THEN
    -- Who cites this section. target_id resolves the edge to this document.
    RETURN QUERY
    SELECT DISTINCT ON (e.source_id)
           COALESCE(s.section_label, s.identifier) AS cite,
           s.identifier,
           s.heading,
           s.source_code AS target_type
    FROM public.citation_edges e
    JOIN public.document_sections s ON s.id = e.source_id
    WHERE e.target_id = v_id
    ORDER BY e.source_id
    LIMIT LEAST(GREATEST(p_limit, 1), 120);
  ELSE
    -- What this section cites. target_id is NULL when the cite didn't resolve
    -- to a section we hold — still useful: the model can search the cite text.
    RETURN QUERY
    SELECT DISTINCT ON (e.target_key)
           e.target_cite AS cite,
           t.identifier,
           t.heading,
           e.target_type
    FROM public.citation_edges e
    LEFT JOIN public.document_sections t ON t.id = e.target_id
    WHERE e.source_id = v_id
    ORDER BY e.target_key
    LIMIT LEAST(GREATEST(p_limit, 1), 120);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.document_citations(text, text, integer)
  TO anon, service_role;

RESET search_path;

NOTIFY pgrst, 'reload schema';
