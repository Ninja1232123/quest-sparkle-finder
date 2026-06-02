-- Recreating the `documents` view (in cap-search-tsv.sql) reset its owner and
-- dropped its grants. Restore the original access so PostgREST keeps serving it:
--   owner    app_user  (so the view reads document_sections with app_user rights)
--   anon          SELECT          (unauthenticated PostgREST reads)
--   service_role  SELECT/INSERT/UPDATE/DELETE  (the admin client the app uses)
--   app_user / selflaw_web / claude_mcp  SELECT  (parity with the base table)
ALTER VIEW public.documents OWNER TO app_user;

GRANT SELECT ON public.documents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO service_role;
GRANT SELECT ON public.documents TO app_user;
GRANT SELECT ON public.documents TO selflaw_web;
GRANT SELECT ON public.documents TO claude_mcp;

-- PostgREST caches the schema; tell it to reload now that the view changed.
NOTIFY pgrst, 'reload schema';
