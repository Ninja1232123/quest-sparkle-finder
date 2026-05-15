-- Raise per-function statement timeout for search RPCs (anon role default is ~3s).
ALTER FUNCTION public.search_documents_fts(text, text, integer)   SET statement_timeout = '15s';
ALTER FUNCTION public.search_documents_trgm(text, text, integer)  SET statement_timeout = '15s';
ALTER FUNCTION public.search_hybrid(text, extensions.vector, text, integer) SET statement_timeout = '20s';