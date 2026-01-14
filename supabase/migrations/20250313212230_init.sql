BEGIN;

-- ===============================
-- PROFILES TABLE
-- ===============================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone_number TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  is_security BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_select"
ON public.profiles
FOR SELECT
USING (true);

CREATE POLICY "profiles_insert"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- ===============================
-- INCIDENTS TABLE
-- ===============================
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidents_select" ON public.incidents;
DROP POLICY IF EXISTS "incidents_insert" ON public.incidents;

CREATE POLICY "incidents_select"
ON public.incidents
FOR SELECT
USING (
  status = 'active'
  OR auth.uid() = user_id
  OR (
    SELECT is_security
    FROM public.profiles
    WHERE id = auth.uid()
  ) = true
);

CREATE POLICY "incidents_insert"
ON public.incidents
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ===============================
-- EMERGENCY CONTACTS TABLE
-- ===============================
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- allow PUBLIC contacts
ALTER TABLE public.emergency_contacts
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_select_public" ON public.emergency_contacts;
DROP POLICY IF EXISTS "contacts_select_own" ON public.emergency_contacts;
DROP POLICY IF EXISTS "contacts_insert" ON public.emergency_contacts;
DROP POLICY IF EXISTS "contacts_delete" ON public.emergency_contacts;

CREATE POLICY "contacts_select_public"
ON public.emergency_contacts
FOR SELECT
USING (user_id IS NULL);

CREATE POLICY "contacts_select_own"
ON public.emergency_contacts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "contacts_insert"
ON public.emergency_contacts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "contacts_delete"
ON public.emergency_contacts
FOR DELETE
USING (auth.uid() = user_id);

-- ===============================
-- AUTO PROFILE CREATION
-- ===============================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ===============================
-- REALTIME
-- ===============================
ALTER PUBLICATION supabase_realtime
ADD TABLE public.incidents;

COMMIT;
