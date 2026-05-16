-- Wipe IRM + USC docs so the fresh NDJSONs can replace them cleanly.
DELETE FROM public.doc_citations
WHERE from_document_id IN (SELECT id FROM public.documents WHERE source_code IN ('irm','usc'))
   OR to_document_id   IN (SELECT id FROM public.documents WHERE source_code IN ('irm','usc'));

DELETE FROM public.documents WHERE source_code IN ('irm','usc','test_load');