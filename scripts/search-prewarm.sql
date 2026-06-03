-- Pre-warm the search cache for common legal queries so even the first broad
-- search is instant (broad-scope rankings otherwise take seconds). Builds cache
-- rows in the EXACT shape the app stores (see searchDocuments): hits = array of
-- {identifier, source_code, parent_label, section_label, heading, snippet,
-- exact:false, semantic:false, trgm:false}, keyed (q_normalized, scope, '', 0).
-- Safe to re-run (upsert). Run after a re-ingest to refresh.
DO $$
DECLARE
  t text; s text;
  terms text[] := ARRAY[
    'contracts','negligence','eminent domain','due process','child custody',
    'divorce','eviction','landlord tenant','employment','discrimination',
    'copyright','trademark','search and seizure','self defense','habeas corpus',
    'statute of limitations','wrongful termination','small claims','probate',
    'wills','trusts','bankruptcy','foreclosure','dui','expungement',
    'restraining order','defamation','zoning','firearms','immigration'];
  scopes text[] := ARRAY['codified','states','all'];
BEGIN
  FOREACH t IN ARRAY terms LOOP
    FOREACH s IN ARRAY scopes LOOP
      -- p_limit 120 + native order (source_pos, rank) preserved via row_number so
      -- the cached array matches a live federated search exactly (the frontend
      -- groups by source in arrival order and slices top-5 per group).
      INSERT INTO public.search_cache (q_normalized, scope, source, semantic, hits, hit_count)
      SELECT lower(t), s, '', 0,
        coalesce(jsonb_agg(jsonb_build_object(
          'identifier',identifier,'source_code',source_code,'parent_label',parent_label,
          'section_label',section_label,'heading',heading,'snippet',snippet,
          'exact',false,'semantic',false,'trgm',false) ORDER BY ord), '[]'::jsonb),
        count(*)
      FROM (SELECT *, row_number() OVER () AS ord
            FROM public.search_documents_fts(t, NULL, 120, s)) f
      ON CONFLICT (q_normalized, scope, source, semantic)
        DO UPDATE SET hits = excluded.hits, hit_count = excluded.hit_count, last_used = now();
    END LOOP;
  END LOOP;
END $$;
