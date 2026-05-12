
-- Forum posts
CREATE TABLE public.forum_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 4 AND 200),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 10 AND 8000),
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts publicly readable" ON public.forum_posts FOR SELECT USING (true);
CREATE POLICY "Authed insert own posts" ON public.forum_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update own posts" ON public.forum_posts FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Owners delete own posts" ON public.forum_posts FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER forum_posts_updated
  BEFORE UPDATE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_forum_posts_created ON public.forum_posts (pinned DESC, created_at DESC);

-- Citations attached to each post (must reference a real document identifier)
CREATE TABLE public.forum_post_citations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL,
  source_code TEXT,
  heading_snapshot TEXT,
  section_label_snapshot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.forum_post_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Citations publicly readable" ON public.forum_post_citations FOR SELECT USING (true);
CREATE POLICY "Owners insert citations" ON public.forum_post_citations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.forum_posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE POLICY "Owners delete citations" ON public.forum_post_citations FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.forum_posts p WHERE p.id = post_id AND p.user_id = auth.uid()));

CREATE INDEX idx_forum_post_citations_post ON public.forum_post_citations (post_id);
CREATE INDEX idx_forum_post_citations_identifier ON public.forum_post_citations (identifier);
