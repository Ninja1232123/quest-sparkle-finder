-- Helper function to resolve internal citation links after bulk inserts.
-- Runs with definer privileges so the data ingestion role can call it without
-- needing UPDATE rights on the table.
CREATE OR REPLACE FUNCTION public.resolve_usc_citations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.usc_citations c
  SET to_section_id = u.id
  FROM public.usc_sections u
  WHERE u.identifier = c.to_identifier
    AND c.to_section_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Allow callers (including the sandbox role) to invoke it.
GRANT EXECUTE ON FUNCTION public.resolve_usc_citations() TO anon, authenticated, service_role;