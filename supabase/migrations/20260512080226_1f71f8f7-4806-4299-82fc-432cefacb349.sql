
-- TOC aggregator: returns (title_group, part_group, count) for a source.
-- title_group is the prefix before " · " in parent_label (e.g. "Title 26 CFR").
-- part_group is the remainder (e.g. "Part 1").
CREATE OR REPLACE FUNCTION public.source_toc(p_source text)
RETURNS TABLE(title_group text, part_group text, doc_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(split_part(parent_label, ' · ', 1), 'Other') AS title_group,
    NULLIF(split_part(parent_label, ' · ', 2), '')        AS part_group,
    COUNT(*)::bigint                                       AS doc_count
  FROM public.documents
  WHERE source_code = p_source
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION public.source_toc(text) TO anon, authenticated;

-- Anonymous search logging
CREATE TABLE IF NOT EXISTS public.search_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  q text NOT NULL,
  q_normalized text NOT NULL,
  source_filter text,
  hit_count integer NOT NULL DEFAULT 0,
  exact_hit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_events_q_norm_idx ON public.search_events (q_normalized);
CREATE INDEX IF NOT EXISTS search_events_created_idx ON public.search_events (created_at DESC);
ALTER TABLE public.search_events ENABLE ROW LEVEL SECURITY;
-- No public policies: only service role (backend) reads/writes.

-- Document view counts
CREATE TABLE IF NOT EXISTS public.doc_views (
  identifier text PRIMARY KEY,
  view_count bigint NOT NULL DEFAULT 0,
  last_viewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doc_views ENABLE ROW LEVEL SECURITY;

-- Helper: increment view counts atomically
CREATE OR REPLACE FUNCTION public.bump_doc_view(p_identifier text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.doc_views (identifier, view_count, last_viewed_at)
  VALUES (p_identifier, 1, now())
  ON CONFLICT (identifier)
  DO UPDATE SET view_count = public.doc_views.view_count + 1,
                last_viewed_at = now();
END;
$$;
