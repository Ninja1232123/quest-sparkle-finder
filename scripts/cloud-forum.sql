-- ============================================================================
-- cloud-forum.sql  —  RUN THIS IN THE CLOUD SUPABASE PROJECT (vjaiqbybhurvnlfladkg)
-- Dashboard → SQL Editor → paste → Run.  (NOT the local self_law DB.)
--
-- Stands up The Floor (forum) on the cloud project, where auth + RLS live.
-- The app reads/writes these tables CLIENT-SIDE with the user's session JWT;
-- RLS is the security boundary. Public law data stays on the local backend.
-- Idempotent.
-- ============================================================================

-- 1. profiles — one row per auth user, holds the display name shown on posts.
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_self_write on public.profiles;
create policy profiles_self_write on public.profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create a profile on signup (display_name from signup metadata, else email local-part).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Backfill profiles for any users who signed up before this ran.
insert into public.profiles (user_id, display_name)
select id, coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
from auth.users
on conflict (user_id) do nothing;

-- 2. forum_posts
create table if not exists public.forum_posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  body       text not null,
  kind       text not null default 'discussion' check (kind in ('discussion','feedback','bug')),
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists forum_posts_created_idx on public.forum_posts (pinned desc, created_at desc);
alter table public.forum_posts enable row level security;
drop policy if exists forum_posts_read on public.forum_posts;
create policy forum_posts_read on public.forum_posts for select using (true);
drop policy if exists forum_posts_insert_own on public.forum_posts;
create policy forum_posts_insert_own on public.forum_posts for insert with check (auth.uid() = user_id);
drop policy if exists forum_posts_delete_own on public.forum_posts;
create policy forum_posts_delete_own on public.forum_posts for delete using (auth.uid() = user_id);

-- 3. forum_post_citations — sections a post cites (snapshotted from the local corpus).
create table if not exists public.forum_post_citations (
  id                     uuid primary key default gen_random_uuid(),
  post_id                uuid not null references public.forum_posts(id) on delete cascade,
  identifier             text not null,
  source_code            text,
  heading_snapshot       text,
  section_label_snapshot text
);
create index if not exists forum_post_citations_post_idx on public.forum_post_citations (post_id);
alter table public.forum_post_citations enable row level security;
drop policy if exists forum_cites_read on public.forum_post_citations;
create policy forum_cites_read on public.forum_post_citations for select using (true);
drop policy if exists forum_cites_insert_own on public.forum_post_citations;
create policy forum_cites_insert_own on public.forum_post_citations for insert
  with check (exists (select 1 from public.forum_posts p where p.id = post_id and p.user_id = auth.uid()));
