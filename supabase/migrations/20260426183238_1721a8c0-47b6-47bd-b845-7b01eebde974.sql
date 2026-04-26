-- Generic document store usable across all legal sources.
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code text NOT NULL,                -- 'usc', 'const', 'ucc', 'tfm', etc.
  identifier text NOT NULL UNIQUE,           -- canonical path, e.g. /us/const/amendment/1
  parent_label text,                         -- e.g. 'Article 2', 'Volume I, Part 1'
  section_label text,                        -- e.g. '§ 2-201', 'Amendment XIV', 'Chapter 1000'
  heading text,
  body_text text,
  body_md text,                              -- preserved markdown for nicer rendering
  hierarchy jsonb,                           -- structured breadcrumb data
  sort_key text,                             -- for stable ordering within a source
  word_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  search_tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(heading, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body_text, '')), 'B')
  ) STORED
);

CREATE INDEX documents_source_idx ON public.documents (source_code, sort_key);
CREATE INDEX documents_search_idx ON public.documents USING GIN (search_tsv);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Documents are publicly readable"
  ON public.documents FOR SELECT TO anon, authenticated USING (true);

-- Citations between any two documents.
CREATE TABLE public.doc_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  to_identifier text NOT NULL,
  to_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  context_snippet text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX doc_citations_from_idx ON public.doc_citations (from_document_id);
CREATE INDEX doc_citations_to_idx ON public.doc_citations (to_document_id);
CREATE INDEX doc_citations_to_ident_idx ON public.doc_citations (to_identifier);

ALTER TABLE public.doc_citations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Document citations are publicly readable"
  ON public.doc_citations FOR SELECT TO anon, authenticated USING (true);

-- Helper: resolve to_document_id for unresolved citation rows.
CREATE OR REPLACE FUNCTION public.resolve_doc_citations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.doc_citations c
  SET to_document_id = d.id
  FROM public.documents d
  WHERE d.identifier = c.to_identifier
    AND c.to_document_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_doc_citations() TO anon, authenticated, service_role;