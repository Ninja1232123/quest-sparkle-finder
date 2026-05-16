CREATE TABLE IF NOT EXISTS public._stage_irm (
  source_code text,
  identifier text,
  parent_label text,
  section_label text,
  heading text,
  body_text text,
  body_md text,
  hierarchy jsonb,
  sort_key text,
  word_count int
);
GRANT ALL ON public._stage_irm TO postgres, anon, authenticated, service_role;