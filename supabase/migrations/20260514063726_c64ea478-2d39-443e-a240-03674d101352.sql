
-- Tighten profiles: remove public read, add owner-only read.
-- Server-side reads of display_name use the service role (bypasses RLS),
-- so public-facing UI still resolves author names.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Owners read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

-- doc_views: silence RLS-no-policy lint. Writes go through SECURITY DEFINER
-- bump_doc_view; only service_role should ever touch the table directly.
CREATE POLICY "Service role manages doc_views" ON public.doc_views
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- search_events: writes happen via supabaseAdmin in server functions.
CREATE POLICY "Service role manages search_events" ON public.search_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Pin search_path on remaining SECURITY DEFINER functions.
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions
-- that should only be invoked by the service role or as triggers.
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_doc_citations() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_usc_citations() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Explicit storage RLS for private buckets ('docs', 'aas'): service_role only.
-- Lovable serves these via signed URLs from server functions.
DROP POLICY IF EXISTS "Service role manages docs bucket" ON storage.objects;
CREATE POLICY "Service role manages docs bucket" ON storage.objects
  FOR ALL TO public
  USING (bucket_id IN ('docs','aas') AND auth.role() = 'service_role')
  WITH CHECK (bucket_id IN ('docs','aas') AND auth.role() = 'service_role');
