
-- 1. Index to fix CFR TOC timeout
CREATE INDEX IF NOT EXISTS idx_documents_source_parent
  ON public.documents (source_code, parent_label, sort_key);

-- 2. Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  supporter_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile"
  ON public.profiles FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Cases
CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cases_user ON public.cases (user_id, archived, updated_at DESC);
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read cases" ON public.cases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owners insert cases" ON public.cases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update cases" ON public.cases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owners delete cases" ON public.cases FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Case items (bookmarks)
CREATE TABLE public.case_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL,
  source_code TEXT,
  heading TEXT,
  section_label TEXT,
  note TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  highlight_color TEXT,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, identifier)
);
CREATE INDEX idx_case_items_user ON public.case_items (user_id, updated_at DESC);
CREATE INDEX idx_case_items_case ON public.case_items (case_id, pinned DESC, created_at DESC);
ALTER TABLE public.case_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read items" ON public.case_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owners insert items" ON public.case_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update items" ON public.case_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owners delete items" ON public.case_items FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_case_items_updated_at
  BEFORE UPDATE ON public.case_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
