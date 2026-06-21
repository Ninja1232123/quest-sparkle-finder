
DROP POLICY IF EXISTS "Posts publicly readable" ON public.forum_posts;
CREATE POLICY "Authenticated users read posts"
  ON public.forum_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "owners update messages"
  ON public.workspace_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
