
CREATE UNLOGGED TABLE IF NOT EXISTS public._stage_irm (
  source_code text, identifier text, parent_label text, section_label text,
  heading text, body_text text, body_md text, hierarchy jsonb,
  sort_key text, word_count int
);
TRUNCATE public._stage_irm;
GRANT INSERT, SELECT, TRUNCATE ON public._stage_irm TO authenticated, anon, service_role;
