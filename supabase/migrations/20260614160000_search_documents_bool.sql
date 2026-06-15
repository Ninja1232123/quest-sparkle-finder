-- Boolean full-text search with explicit logic gates.
--
-- search_documents_fts AND-s a single query string and auto-relaxes to OR on a
-- miss — good for the fast path, but the model can't *control* the combination.
-- This exposes the gates directly: every `all` term is AND-ed, the `any` terms
-- form one OR group, `phrase` matches an exact ordered phrase, and `not` terms
-- are excluded. The query is composed from tsquery operators server-side
-- (plainto/phraseto + && || !!), so the caller never hand-builds tsquery syntax.
--
-- Returns the same shape as search_documents_fts so the chat tool maps it
-- identically. Apply to self_law; needs a PostgREST schema reload.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.search_documents_bool(
  p_all    text[]  DEFAULT '{}',
  p_any    text[]  DEFAULT '{}',
  p_phrase text    DEFAULT NULL,
  p_not    text[]  DEFAULT '{}',
  p_source text    DEFAULT NULL,
  p_limit  integer DEFAULT 10
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
  v_q    tsquery;
  v_any  tsquery;
  v_not  tsquery;
  v_part tsquery;
  t      text;
BEGIN
  -- AND group: every term must appear.
  FOREACH t IN ARRAY COALESCE(p_all, '{}') LOOP
    v_part := plainto_tsquery('english', t);
    IF v_part IS NOT NULL AND v_part::text <> '' THEN
      v_q := CASE WHEN v_q IS NULL THEN v_part ELSE v_q && v_part END;
    END IF;
  END LOOP;

  -- OR group: at least one term must appear; AND-ed against the rest as a unit.
  FOREACH t IN ARRAY COALESCE(p_any, '{}') LOOP
    v_part := plainto_tsquery('english', t);
    IF v_part IS NOT NULL AND v_part::text <> '' THEN
      v_any := CASE WHEN v_any IS NULL THEN v_part ELSE v_any || v_part END;
    END IF;
  END LOOP;
  IF v_any IS NOT NULL THEN
    v_q := CASE WHEN v_q IS NULL THEN v_any ELSE v_q && v_any END;
  END IF;

  -- Exact ordered phrase.
  IF p_phrase IS NOT NULL AND length(btrim(p_phrase)) > 0 THEN
    v_part := phraseto_tsquery('english', p_phrase);
    IF v_part IS NOT NULL AND v_part::text <> '' THEN
      v_q := CASE WHEN v_q IS NULL THEN v_part ELSE v_q && v_part END;
    END IF;
  END IF;

  -- Pure exclusion is meaningless — there must be something to match first.
  IF v_q IS NULL THEN
    RETURN;
  END IF;

  -- NOT group: exclude documents containing any of these.
  FOREACH t IN ARRAY COALESCE(p_not, '{}') LOOP
    v_part := plainto_tsquery('english', t);
    IF v_part IS NOT NULL AND v_part::text <> '' THEN
      v_not := CASE WHEN v_not IS NULL THEN v_part ELSE v_not || v_part END;
    END IF;
  END LOOP;
  IF v_not IS NOT NULL THEN
    v_q := v_q && !!v_not;
  END IF;

  RETURN QUERY
  SELECT d.identifier,
         d.source_code,
         d.parent_label,
         d.section_label,
         d.heading,
         ts_headline('english', left(COALESCE(d.body_text, ''), 12000), v_q,
           'MaxFragments=2,MinWords=8,MaxWords=24,StartSel=<mark>,StopSel=</mark>') AS snippet,
         ts_rank_cd(d.search_tsv, v_q) AS rank
  FROM public.document_sections d
  WHERE d.search_tsv @@ v_q
    AND (p_source IS NULL OR d.source_code = p_source)
  ORDER BY rank DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_documents_bool(text[], text[], text, text[], text, integer)
  TO anon, service_role;

RESET search_path;

NOTIFY pgrst, 'reload schema';
