
-- Blog posts table
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  body_md text NOT NULL DEFAULT '',
  cover_image_url text,
  tags text[] NOT NULL DEFAULT '{}',
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  author_name text,
  seo_title text,
  seo_description text,
  view_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND length(slug) BETWEEN 1 AND 120),
  CONSTRAINT blog_posts_title_length CHECK (length(title) BETWEEN 1 AND 200)
);

CREATE INDEX blog_posts_published_idx ON public.blog_posts (published, published_at DESC);
CREATE INDEX blog_posts_tags_idx ON public.blog_posts USING GIN (tags);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Helper: is this caller the configured admin?
CREATE OR REPLACE FUNCTION public.is_blog_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT current_setting('app.admin_user_id', true) IS NOT NULL
     AND auth.uid()::text = current_setting('app.admin_user_id', true);
$$;

-- Public reads only published posts
CREATE POLICY "Published posts are publicly readable"
ON public.blog_posts FOR SELECT
USING (published = true);

-- Service role (server functions w/ service key) can do everything
CREATE POLICY "Service role manages all posts"
ON public.blog_posts FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER blog_posts_set_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
