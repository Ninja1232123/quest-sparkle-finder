-- Search relax: keep AND precision, but fall back to OR when AND finds nothing.
--
-- websearch_to_tsquery ANDs every term, so a long natural-language query
-- ("debt collector definition 15 USC 1692") requires ONE section containing
-- every term and usually returns zero — even when the section plainly exists.
-- This is a SURGICAL patch of the existing 7-arg federation function: the whole
-- per-source pipeline keys off a single tsquery variable (v_tsq). We compute the
-- precise AND query first (best for expert keyword searches); only if nothing in
-- scope matches it do we swap v_tsq to an OR of the same lexemes. Everything
-- downstream — the per-source pool, heading re-rank, federation, ts_headline —
-- inherits the relaxed query automatically. Precise queries are unchanged;
-- casual/verbose queries now return ranked results instead of an empty page.
--
-- Operates on public.document_sections. Apply to the self_law (corpus) database.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.search_documents_fts(
  p_query               text,
  p_source              text    DEFAULT NULL,
  p_limit               integer DEFAULT 120,
  p_scope               text    DEFAULT 'codified',
  p_per_source          integer DEFAULT 30,
  p_display_per_source  integer DEFAULT 6,
  p_max_sources         integer DEFAULT 14
)
RETURNS TABLE (
  identifier    text,
  source_code   text,
  parent_label  text,
  section_label text,
  heading       text,
  snippet       text,
  rank          real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sources text[] := public._scope_sources(p_scope, p_source);
  v_lim     integer := LEAST(GREATEST(p_limit, 1), 200);
  v_per     integer := LEAST(GREATEST(p_per_source, 5), 100);
  v_disp    integer := LEAST(GREATEST(p_display_per_source, 1), 25);
  v_maxsrc  integer := CASE WHEN p_source IS NOT NULL THEN 1
                            ELSE LEAST(GREATEST(p_max_sources, 1), 60) END;
  v_tsq     tsquery := websearch_to_tsquery('english', p_query);
  -- Relaxed form: turn top-level ANDs into ORs. Phrase (<->) and exclusion (!)
  -- operators are preserved; only '&' is swapped. NULL if query was empty.
  v_tsq_or  tsquery := NULLIF(replace(websearch_to_tsquery('english', p_query)::text, '&', '|'), '')::tsquery;
BEGIN
  IF v_sources IS NULL THEN
    WITH RECURSIVE s AS (
      (SELECT ds.source_code AS sc FROM public.document_sections ds ORDER BY ds.source_code LIMIT 1)
      UNION ALL
      SELECT (SELECT ds.source_code FROM public.document_sections ds
              WHERE ds.source_code > s.sc ORDER BY ds.source_code LIMIT 1)
      FROM s WHERE s.sc IS NOT NULL
    )
    SELECT array_agg(s.sc) INTO v_sources FROM s WHERE s.sc IS NOT NULL;
  END IF;

  IF v_sources IS NULL OR array_length(v_sources, 1) IS NULL THEN
    RETURN;  -- empty scope (e.g. 'cases')
  END IF;

  -- AND-first / OR-relax: if the precise AND query matches nothing in scope,
  -- fall back to the OR form so verbose/casual queries still return ranked hits.
  IF v_tsq IS NULL
     OR NOT EXISTS (
          SELECT 1 FROM public.document_sections d
          WHERE d.search_tsv @@ v_tsq
            AND d.source_code = ANY (v_sources)
        )
  THEN
    v_tsq := v_tsq_or;
  END IF;

  IF v_tsq IS NULL THEN
    RETURN;  -- nothing searchable
  END IF;

  IF p_source IS NOT NULL THEN
    v_disp := v_lim;
  END IF;

  RETURN QUERY
  WITH matches AS MATERIALIZED (
    SELECT d.id, d.source_code,
           ts_rank_cd(d.search_tsv, v_tsq) AS tr,
           coalesce(a.authority, 1.0) AS authority
    FROM public.document_sections d
    LEFT JOIN public.doc_authority a ON a.id = d.id
    WHERE d.search_tsv @@ v_tsq
      AND d.source_code = ANY (v_sources)
  ),
  cand AS (
    SELECT m.id, m.authority
    FROM (
      SELECT matches.id, matches.authority,
             row_number() OVER (PARTITION BY matches.source_code ORDER BY matches.tr DESC) AS rn
      FROM matches
    ) m
    WHERE m.rn <= v_per
  ),
  scored AS (
    SELECT c.id, d.source_code,
           ts_rank('{0.1,0.2,0.4,1.0}',
             setweight(to_tsvector('english', coalesce(d.heading,'') || ' ' || coalesce(d.section_label,'')), 'A')
             || setweight(to_tsvector('english', left(coalesce(d.body_text,''), 12000)), 'D'),
             v_tsq)
           * (1.0 + 0.12 * ln(1.0 + c.authority))
             AS rank
    FROM cand c
    JOIN public.document_sections d ON d.id = c.id
  ),
  within AS (
    SELECT s.id, s.source_code, s.rank,
           row_number() OVER (PARTITION BY s.source_code ORDER BY s.rank DESC) AS rn,
           max(s.rank)   OVER (PARTITION BY s.source_code) AS src_best
    FROM scored s
  ),
  src_order AS (
    SELECT u.source_code, u.src_best,
           row_number() OVER (ORDER BY u.src_best DESC, u.source_code) AS source_pos
    FROM (SELECT DISTINCT within.source_code, within.src_best FROM within) u
  ),
  kept AS (
    SELECT w.id, w.rank, o.source_pos
    FROM within w
    JOIN src_order o ON o.source_code = w.source_code
    WHERE w.rn <= v_disp
      AND o.source_pos <= v_maxsrc
    ORDER BY o.source_pos, w.rank DESC
    LIMIT v_lim
  )
  SELECT d.identifier, d.source_code, d.parent_label, d.section_label, d.heading,
         ts_headline('english', left(d.body_text, 8000), v_tsq,
           'MaxFragments=2,MaxWords=32,MinWords=10,StartSel=<mark>,StopSel=</mark>,HighlightAll=false'
         ) AS snippet,
         k.rank::real
  FROM kept k
  JOIN public.document_sections d ON d.id = k.id
  ORDER BY k.source_pos, k.rank DESC;
END;
$function$;

RESET search_path;
