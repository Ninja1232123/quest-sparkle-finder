-- 1. Hide forum_posts.user_id from anon/authenticated direct queries.
-- RLS still allows row visibility; column-level GRANT prevents user_id leakage.
REVOKE SELECT ON public.forum_posts FROM anon, authenticated;
GRANT SELECT (id, kind, title, body, pinned, created_at, updated_at)
  ON public.forum_posts TO anon, authenticated;

-- 2. Service-role-only policies for previously unpoliced private buckets.
DO $$
DECLARE
  b text;
  buckets text[] := ARRAY[
    'irm','usc','fedregister','congressionalbills','privateandpubli',
    'statutes','papersfrompresident','statutesatlarge',
    'fedregister2','fedregister3','fedregister4','fedregister5',
    'fedregister6','fedregister7'
  ];
BEGIN
  FOREACH b IN ARRAY buckets LOOP
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR ALL TO public USING (bucket_id = %L AND auth.role() = ''service_role'') WITH CHECK (bucket_id = %L AND auth.role() = ''service_role'')',
      'Service role manages ' || b, b, b
    );
  END LOOP;
END $$;