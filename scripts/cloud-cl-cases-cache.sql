-- Run in cloud Supabase (project ztyhvhrvbplqkmivizxd → SQL Editor)
-- Caches CourtListener case metadata per statute section identifier.
-- Rows are upserted by the server on cache miss; public read so anyone
-- can see the cases panel (the free conversion hook).

CREATE TABLE IF NOT EXISTS cl_section_cases (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier    text    NOT NULL,
  cl_cluster_id bigint  NOT NULL,
  case_name     text    NOT NULL,
  court         text,
  date_filed    date,
  cite_count    integer DEFAULT 0,
  cl_url        text    NOT NULL,
  fetched_at    timestamptz DEFAULT now(),
  UNIQUE (identifier, cl_cluster_id)
);

-- Fast lookup: all cases for a section, ordered by precedential weight.
CREATE INDEX IF NOT EXISTS cl_section_cases_lookup
  ON cl_section_cases (identifier, cite_count DESC);

-- Fast staleness check.
CREATE INDEX IF NOT EXISTS cl_section_cases_freshness
  ON cl_section_cases (identifier, fetched_at DESC);

ALTER TABLE cl_section_cases ENABLE ROW LEVEL SECURITY;

-- Anyone can read — cases are public data and the panel is visible before login.
CREATE POLICY "cl_cases_select_public"
  ON cl_section_cases FOR SELECT USING (true);

-- Writes via service role (bypasses RLS); no client-side insert needed.
