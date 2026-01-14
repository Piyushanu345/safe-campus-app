BEGIN;

-- =========================
-- PROFILES TABLE
-- =========================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    phone_number TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    is_security BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE
      DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Public profiles are viewable by everyone"
ON public.profiles
FOR SELECT
USING (true);

CREATE POLICY IF NOT EXISTS "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- =========================
-- INCIDENTS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    type TEXT NOT NULL,
    description TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE
      DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Incidents visibility policy" ON public.incidents;

CREATE POLICY "Incidents visibility policy"
ON public.incidents
FOR SELECT
USING (
    type != 'SOS'
    OR auth.uid() = user_id
    OR (
        SELECT is_security
        FROM public.profiles
        WHERE id = auth.uid()
    ) = true
);

CREATE POLICY IF NOT EXISTS "Authenticated users can insert incidents"
ON public.incidents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =========================
-- EMERGENCY CONTACTS TABLE  (THIS FIXES YOUR ERROR)
-- =========================
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE
      DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Allow PUBLIC contacts
ALTER TABLE public.emergency_contacts
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Public contacts (Police, Ambulance, etc.)
CREATE POLICY IF NOT EXISTS "Anyone can read public contacts"
ON public.emergency_contacts
FOR SELECT
USING (user_id IS NULL);

-- Private contacts
CREATE POLICY IF NOT EXISTS "Users can read their own contacts"
ON public.emergency_contacts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their contacts"
ON public.emergency_contacts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their contacts"
ON public.emergency_contacts
FOR DELETE
USING (auth.uid() = user_id);

-- =========================
-- AUTO PROFILE CREATION
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- REALTIME
-- =========================
ALTER PUBLICATION supabase_realtime
ADD TABLE public.incidents;

COMMIT;
