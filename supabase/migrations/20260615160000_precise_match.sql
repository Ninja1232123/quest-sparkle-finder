-- precise_match: live "precision drill" over the FTS index.
--
-- The point (per the product): you pin the ONE on-point section by AND-ing a
-- handful of DIVERSE terms that never sit next to each other but all live in that
-- document — e.g. {foreclosure, election, remedies, extinguish, collection} ->
-- a single Treas. Reg. section. Which terms apply varies every case, so this is
-- LIVE, not precomputed.
--
-- The efficiency move ("cut wasteful searches"): a too-broad combo returns ONLY
-- the (bounded) count and NO rows — nothing is transferred until the combo has
-- narrowed to <= p_max hits. So the model can probe deeper combos for almost
-- nothing and only pulls citations once the search is actually surgical.
--
-- Returns jsonb { count, broad, results[] }. Apply to self_law; reload PostgREST.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.precise_match(
  p_terms  text[],
  p_source text    DEFAULT NULL,
  p_max    integer DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tsq tsquery := NULL;
  v_q   tsquery;
  t     text;
  v_cnt integer;
  v_max integer := LEAST(GREATEST(p_max, 1), 100);
  v_res jsonb;
BEGIN
  -- AND every term together (each term lexemized independently).
  FOREACH t IN ARRAY p_terms LOOP
    v_q := plainto_tsquery('english', t);
    IF v_q IS NULL OR v_q::text = '' THEN
      CONTINUE;
    END IF;
    v_tsq := CASE WHEN v_tsq IS NULL THEN v_q ELSE v_tsq && v_q END;
  END LOOP;

  IF v_tsq IS NULL THEN
    RETURN jsonb_build_object('count', 0, 'broad', false, 'results', '[]'::jsonb);
  END IF;

  -- Bounded count: stop at v_max+1 so even a broad combo is cheap.
  SELECT count(*) INTO v_cnt FROM (
    SELECT 1 FROM public.document_sections d
    WHERE d.search_tsv @@ v_tsq
      AND (p_source IS NULL OR d.source_code = p_source)
    LIMIT v_max + 1
  ) s;

  -- Too broad: hand back the signal, transfer no rows. That's the whole point.
  IF v_cnt > v_max THEN
    RETURN jsonb_build_object('count', v_cnt, 'broad', true, 'results', '[]'::jsonb);
  END IF;

  -- Surgical enough: return the handful of citations (lean rows, no bodies).
  SELECT coalesce(jsonb_agg(r ORDER BY rk DESC), '[]'::jsonb) INTO v_res FROM (
    SELECT
      ts_rank_cd(d.search_tsv, v_tsq) AS rk,
      jsonb_build_object(
        'id', d.identifier,
        'source', d.source_code,
        'cite', coalesce(d.section_label, d.heading, d.identifier),
        'heading', CASE
          WHEN d.section_label IS NOT NULL AND d.heading IS NOT NULL AND d.heading <> d.section_label
          THEN d.heading ELSE NULL END
      ) AS r
    FROM public.document_sections d
    WHERE d.search_tsv @@ v_tsq
      AND (p_source IS NULL OR d.source_code = p_source)
    ORDER BY rk DESC
    LIMIT v_max
  ) q;

  RETURN jsonb_build_object('count', v_cnt, 'broad', false, 'results', v_res);
END;
$$;

GRANT EXECUTE ON FUNCTION public.precise_match(text[], text, integer)
  TO anon, service_role;

RESET search_path;

NOTIFY pgrst, 'reload schema';
