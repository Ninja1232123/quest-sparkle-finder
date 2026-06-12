
CREATE TABLE public.workspace_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New session',
  summary text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_threads TO authenticated;
GRANT ALL ON public.workspace_threads TO service_role;
ALTER TABLE public.workspace_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read threads" ON public.workspace_threads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owners insert threads" ON public.workspace_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners update threads" ON public.workspace_threads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owners delete threads" ON public.workspace_threads FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX workspace_threads_user_recent_idx ON public.workspace_threads(user_id, last_message_at DESC);

CREATE TABLE public.workspace_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.workspace_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_messages TO authenticated;
GRANT ALL ON public.workspace_messages TO service_role;
ALTER TABLE public.workspace_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read messages" ON public.workspace_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owners insert messages" ON public.workspace_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners delete messages" ON public.workspace_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX workspace_messages_thread_idx ON public.workspace_messages(thread_id, created_at);

CREATE TABLE public.workspace_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.workspace_threads(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'memo',
  title text NOT NULL,
  body_md text NOT NULL DEFAULT '',
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_documents TO authenticated;
GRANT ALL ON public.workspace_documents TO service_role;
ALTER TABLE public.workspace_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read docs" ON public.workspace_documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owners insert docs" ON public.workspace_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners update docs" ON public.workspace_documents FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owners delete docs" ON public.workspace_documents FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX workspace_documents_thread_idx ON public.workspace_documents(thread_id, created_at DESC);
CREATE INDEX workspace_documents_user_idx ON public.workspace_documents(user_id, created_at DESC);

CREATE TRIGGER workspace_threads_set_updated_at BEFORE UPDATE ON public.workspace_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER workspace_documents_set_updated_at BEFORE UPDATE ON public.workspace_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
