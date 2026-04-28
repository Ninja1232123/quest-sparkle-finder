DELETE FROM public.doc_citations 
WHERE from_document_id IN (SELECT id FROM public.documents WHERE source_code = 'usc');
DELETE FROM public.documents WHERE source_code = 'usc';