
CREATE TABLE public.workspace_case_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.workspace_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('authority','question','note')),
  stance text CHECK (stance IN ('support','adverse','neutral')),
  identifier text,
  citation text,
  heading text,
  pin_cite text,
  quote text,
  user_note text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wci_thread ON public.workspace_case_items(thread_id, kind, order_index);
CREATE INDEX idx_wci_user ON public.workspace_case_items(user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_case_items TO authenticated;
GRANT ALL ON public.workspace_case_items TO service_role;

ALTER TABLE public.workspace_case_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wci read own" ON public.workspace_case_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wci insert own" ON public.workspace_case_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wci update own" ON public.workspace_case_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wci delete own" ON public.workspace_case_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_wci_updated_at BEFORE UPDATE ON public.workspace_case_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.workspace_draft_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.workspace_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  body_md text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wdv_thread ON public.workspace_draft_versions(thread_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.workspace_draft_versions TO authenticated;
GRANT ALL ON public.workspace_draft_versions TO service_role;

ALTER TABLE public.workspace_draft_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wdv read own" ON public.workspace_draft_versions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wdv insert own" ON public.workspace_draft_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wdv delete own" ON public.workspace_draft_versions FOR DELETE TO authenticated USING (auth.uid() = user_id);
