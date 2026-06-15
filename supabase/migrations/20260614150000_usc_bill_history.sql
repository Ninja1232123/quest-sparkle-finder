-- USC section -> the congressional bills that amended (or proposed to amend) it.
--
-- bill_meta.usc_refs (populated by scripts/bill_parse.py) records, per bill, the
-- U.S. Code titles + sections it touches. This RPC reverses that: given a USC
-- title + section, return the bills that reached for it, enacted first then
-- newest Congress — the legislative history, Congress's own words behind the
-- codified text. The mirror of cfr_register_history for the statute side.
--
-- Apply to the self_law (corpus) database. Needs a PostgREST schema reload
-- (NOTIFY pgrst, 'reload schema') so the RPC is callable.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.usc_bill_history(
  p_title   integer,
  p_section text,
  p_limit   integer DEFAULT 40
)
RETURNS TABLE (
  bill_key     text,
  latest_id    text,
  title        text,
  short_title  text,
  congress     integer,
  bill_type    text,
  number       integer,
  latest_stage text,
  enacted      boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bm.bill_key,
         bm.latest_id,
         bm.title,
         bm.short_title,
         bm.congress,
         bm.bill_type,
         bm.number,
         bm.latest_stage,
         bm.enacted
  FROM public.bill_meta bm
  WHERE bm.usc_refs @> jsonb_build_array(jsonb_build_object('title', p_title))
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(bm.usc_refs) e
      WHERE (e->>'title')::int = p_title
        AND e->'sections' ? p_section
    )
  ORDER BY bm.enacted DESC, bm.congress DESC NULLS LAST, bm.number
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

-- Self-hosted self_law has roles anon / authenticator / service_role (no
-- "authenticated"). PostgREST's anon + service_role are what need execute.
GRANT EXECUTE ON FUNCTION public.usc_bill_history(integer, text, integer)
  TO anon, service_role;

RESET search_path;

NOTIFY pgrst, 'reload schema';
