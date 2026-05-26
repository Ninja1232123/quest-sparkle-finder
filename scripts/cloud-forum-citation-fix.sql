-- ============================================================================
-- cloud-forum-citation-fix.sql  —  RUN IN THE CLOUD SUPABASE PROJECT (vjaiqbybhurvnlfladkg)
-- Dashboard → SQL Editor → paste → Run.  (NOT the local self_law DB.)
--
-- Fix: the forum_post_citations INSERT policy calls owns_forum_post(post_id).
-- That helper was SECURITY DEFINER, so it ran as the function OWNER — which
-- lacks SELECT on forum_posts in this project → "permission denied for table
-- forum_posts". Run it as the CALLER instead (SECURITY INVOKER): the
-- authenticated role already has SELECT on forum_posts and its RLS is
-- `using (true)`, so the ownership check resolves correctly. The policy itself
-- is unchanged. Idempotent; folded into cloud-forum.sql.
-- ============================================================================

create or replace function public.owns_forum_post(p_post_id uuid)
returns boolean language sql security invoker stable set search_path = public as $$
  select exists (
    select 1 from public.forum_posts p
    where p.id = p_post_id and p.user_id = auth.uid()
  );
$$;
grant execute on function public.owns_forum_post(uuid) to authenticated;

-- Confirmation (shown as the result): owners + that authenticated can read.
select
  (select tableowner from pg_tables where schemaname = 'public' and tablename = 'forum_posts') as forum_posts_owner,
  (select r.rolname from pg_proc p join pg_roles r on r.oid = p.proowner where p.proname = 'owns_forum_post') as fn_owner,
  has_table_privilege('authenticated', 'public.forum_posts', 'SELECT') as authenticated_can_select;
