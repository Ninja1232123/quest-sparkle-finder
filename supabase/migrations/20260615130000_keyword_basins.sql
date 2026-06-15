-- Keyword basins: precomputed AND/OR trigger-word result-sets.
--
-- Idea (the cheap "stable basins"): instead of the model live-scanning 3.4M
-- sections every turn, we precompute a pile of AND/OR combinations of legal
-- trigger words, run each against the FTS index ONCE, and cache the doc-ids each
-- combo returns. At query time the model lands on a basin and gets a few-hundred
-- cached rows — ~1/1000th of the corpus — and can dig deep cheaply. We never read
-- the bodies; the value is the overlap structure (which combos return the same
-- docs vs. genuinely different ones).
--
-- No embeddings, no clustering, no Claude calls — just SQL FTS, built offline by
-- scripts/keyword_basins.py. Apply to self_law; reload PostgREST.

SET search_path = public, extensions;

-- One basin per trigger-word combination -------------------------------------
CREATE TABLE IF NOT EXISTS public.keyword_basins (
  id           bigserial PRIMARY KEY,
  op           text   NOT NULL,            -- 'single' | 'and' | 'or'
  terms        text[] NOT NULL,            -- the trigger words in the combo
  label        text   NOT NULL,            -- human-readable, e.g. 'fraud & notice'
  doc_count    integer NOT NULL DEFAULT 0, -- cached hits (capped at top-K)
  refreshed_at timestamptz NOT NULL DEFAULT now()
);
-- One row per (op,label) so re-runs upsert instead of duplicating.
CREATE UNIQUE INDEX IF NOT EXISTS keyword_basins_op_label
  ON public.keyword_basins (op, label);
-- Find basins by trigger word.
CREATE INDEX IF NOT EXISTS keyword_basins_terms_gin
  ON public.keyword_basins USING gin (terms);

-- The cached membership: combo -> the doc-ids it matched (top-K by rank) -------
CREATE TABLE IF NOT EXISTS public.keyword_basin_doc (
  basin_id bigint NOT NULL REFERENCES public.keyword_basins(id) ON DELETE CASCADE,
  doc_id   bigint NOT NULL,
  rank     real,
  PRIMARY KEY (basin_id, doc_id)
);
-- Reverse lookup doc -> basins is the overlap signal (which combos share a doc).
CREATE INDEX IF NOT EXISTS keyword_basin_doc_doc
  ON public.keyword_basin_doc (doc_id);

-- Read RPCs -------------------------------------------------------------------

-- List basins matching a trigger word (or all, biggest first). Lets the model
-- aim: pick the combo, then pull its cached docs — no live scan of 3.4M.
CREATE OR REPLACE FUNCTION public.basin_list(
  p_term  text    DEFAULT NULL,
  p_limit integer DEFAULT 60
)
RETURNS TABLE (id bigint, op text, label text, terms text[], doc_count integer)
LANGUAGE sql STABLE
AS $$
  SELECT b.id, b.op, b.label, b.terms, b.doc_count
  FROM public.keyword_basins b
  WHERE p_term IS NULL OR b.terms @> ARRAY[lower(p_term)]
  ORDER BY b.doc_count DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;

-- Pull a basin's cached result-set (lean rows, no bodies). This is the whole
-- point: the field is already computed, so this is a keyed read, not a scan.
CREATE OR REPLACE FUNCTION public.basin_docs(
  p_basin_id bigint,
  p_source   text    DEFAULT NULL,
  p_limit    integer DEFAULT 200
)
RETURNS TABLE (identifier text, source_code text, section_label text, heading text, rank real)
LANGUAGE sql STABLE
AS $$
  SELECT d.identifier, d.source_code, d.section_label, d.heading, m.rank
  FROM public.keyword_basin_doc m
  JOIN public.document_sections d ON d.id = m.doc_id
  WHERE m.basin_id = p_basin_id
    AND (p_source IS NULL OR d.source_code = p_source)
  ORDER BY m.rank DESC NULLS LAST
  LIMIT LEAST(GREATEST(p_limit, 1), 500);
$$;

GRANT EXECUTE ON FUNCTION public.basin_list(text, integer)            TO anon, service_role;
GRANT EXECUTE ON FUNCTION public.basin_docs(bigint, text, integer)    TO anon, service_role;
GRANT SELECT  ON public.keyword_basins, public.keyword_basin_doc      TO anon, service_role;

RESET search_path;

NOTIFY pgrst, 'reload schema';
