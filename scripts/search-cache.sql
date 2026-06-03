-- Result cache for search. The corpus is static between ingests, so a given
-- (query, scope, source, semantic) always produces the same ranked hits — no
-- reason to recompute the expensive broad-scope rankings (a common term like
-- "contracts" matches ~350k rows; ranking them is seconds). Compute once, store
-- the hit list as JSON, serve instantly thereafter. Invalidate by TRUNCATE when
-- the corpus changes (rare).
CREATE TABLE IF NOT EXISTS public.search_cache (
  q_normalized text        NOT NULL,
  scope        text        NOT NULL DEFAULT 'codified',
  source       text        NOT NULL DEFAULT '',
  semantic     integer     NOT NULL DEFAULT 0,
  hits         jsonb       NOT NULL,
  hit_count    integer     NOT NULL,
  uses         integer     NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (q_normalized, scope, source, semantic)
);

GRANT SELECT, INSERT, UPDATE ON public.search_cache TO service_role;
GRANT SELECT ON public.search_cache TO anon;

-- Usage bump for a cache hit (fire-and-forget from the app).
CREATE OR REPLACE FUNCTION public.bump_search_cache(
  q_normalized text, scope text, source text, semantic integer)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $fn$
  UPDATE public.search_cache c
     SET uses = c.uses + 1, last_used = now()
   WHERE c.q_normalized = bump_search_cache.q_normalized
     AND c.scope        = bump_search_cache.scope
     AND c.source       = bump_search_cache.source
     AND c.semantic     = bump_search_cache.semantic;
$fn$;
GRANT EXECUTE ON FUNCTION public.bump_search_cache(text,text,text,integer) TO anon, service_role;
