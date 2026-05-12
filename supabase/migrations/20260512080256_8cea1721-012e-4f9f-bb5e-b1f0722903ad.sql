
ALTER FUNCTION public.source_toc(text) SECURITY INVOKER;
ALTER FUNCTION public.bump_doc_view(text) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.bump_doc_view(text) FROM anon, authenticated;
