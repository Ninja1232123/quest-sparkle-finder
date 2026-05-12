DELETE FROM public.documents WHERE source_code = 'test';

DO $$
DECLARE
  rows_updated INT;
BEGIN
  LOOP
    WITH batch AS (
      SELECT id FROM public.documents
      WHERE source_code = 'cfr' AND section_label LIKE '§ §%'
      LIMIT 5000
    )
    UPDATE public.documents d
    SET section_label = regexp_replace(d.section_label, '^§\s*§\s*', '§ ')
    FROM batch
    WHERE d.id = batch.id;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;
  END LOOP;
END $$;