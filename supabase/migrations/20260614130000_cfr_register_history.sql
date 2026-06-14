-- CFR section -> its Federal Register rulemaking history.
--
-- register_meta.cfr_refs (populated by scripts/register_parse.py) records the
-- CFR title + parts each Federal Register rule amends. This RPC reverses that:
-- given a CFR title + part, return the rulemakings that touched it, newest
-- first — the regulatory history with the agency's own reasoning behind it.
--
-- Apply to the self_law (corpus) database. Needs a PostgREST schema reload
-- (NOTIFY pgrst, 'reload schema') so the RPC is callable.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.cfr_register_history(
  p_title integer,
  p_part  integer,
  p_limit integer DEFAULT 40
)
RETURNS TABLE (
  fr_doc_number text,
  identifier    text,
  title         text,
  doc_type      text,
  decided       date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rm.fr_doc_number,
         d.identifier,
         rm.title,
         d.section_label AS doc_type,
         make_date(split_part(d.identifier, '/', 3)::int,
                   split_part(d.identifier, '/', 4)::int,
                   split_part(d.identifier, '/', 5)::int) AS decided
  FROM public.register_meta rm
  JOIN public.document_sections d ON d.id = rm.id
  WHERE rm.cfr_refs @> jsonb_build_array(jsonb_build_object('title', p_title))
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(rm.cfr_refs) e
      WHERE (e->>'title')::int = p_title
        AND e->'parts' @> to_jsonb(p_part)
    )
  ORDER BY decided DESC NULLS LAST
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

-- Self-hosted self_law has roles anon / authenticator / service_role (no
-- "authenticated"). PostgREST's anon + service_role are what need execute.
GRANT EXECUTE ON FUNCTION public.cfr_register_history(integer, integer, integer)
  TO anon, service_role;

RESET search_path;

NOTIFY pgrst, 'reload schema';
