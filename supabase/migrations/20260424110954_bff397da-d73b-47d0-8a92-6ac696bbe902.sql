-- Sources registry
CREATE TABLE public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  version_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sources are publicly readable"
ON public.sources FOR SELECT
USING (true);

-- USC sections
CREATE TABLE public.usc_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL UNIQUE,         -- e.g. /us/usc/t1/s101
  title_num INT NOT NULL,
  chapter TEXT,
  section_num TEXT NOT NULL,               -- string because of "101a", "1-1", etc.
  heading TEXT,
  body_text TEXT,                          -- plaintext for search
  body_html TEXT,                          -- rendered markup
  hierarchy JSONB,                         -- {title, subtitle, chapter, subchapter, part, ...}
  search_tsv TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(heading, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body_text, '')), 'B')
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX usc_sections_search_idx ON public.usc_sections USING GIN (search_tsv);
CREATE INDEX usc_sections_title_idx ON public.usc_sections (title_num, section_num);

ALTER TABLE public.usc_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "USC sections are publicly readable"
ON public.usc_sections FOR SELECT
USING (true);

-- Citation edges
CREATE TABLE public.usc_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_section_id UUID NOT NULL REFERENCES public.usc_sections(id) ON DELETE CASCADE,
  to_identifier TEXT NOT NULL,             -- target USLM ref, may resolve to a section or external
  to_section_id UUID REFERENCES public.usc_sections(id) ON DELETE SET NULL,
  context_snippet TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX usc_citations_from_idx ON public.usc_citations (from_section_id);
CREATE INDEX usc_citations_to_ident_idx ON public.usc_citations (to_identifier);
CREATE INDEX usc_citations_to_section_idx ON public.usc_citations (to_section_id);

ALTER TABLE public.usc_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Citations are publicly readable"
ON public.usc_citations FOR SELECT
USING (true);

-- Seed sources
INSERT INTO public.sources (code, name, description) VALUES
  ('usc',    'United States Code',          'Codified general and permanent federal statutes'),
  ('ucc',    'Uniform Commercial Code',     'Model commercial law adopted by states'),
  ('tfm',    'Treasury Financial Manual',   'Treasury policies and procedures for federal agencies'),
  ('const',  'U.S. Constitution',           'Constitution of the United States and amendments');