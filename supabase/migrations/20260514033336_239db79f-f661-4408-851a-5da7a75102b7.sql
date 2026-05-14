ALTER TABLE public.forum_posts ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'discussion';
CREATE INDEX IF NOT EXISTS idx_forum_posts_kind ON public.forum_posts(kind);