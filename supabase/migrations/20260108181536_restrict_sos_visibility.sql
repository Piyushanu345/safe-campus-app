BEGIN;

-- Add is_security to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_security BOOLEAN DEFAULT FALSE;

-- Drop existing incident select policy
DROP POLICY IF EXISTS "Incidents are viewable by everyone." ON public.incidents;

-- New Incident Select Policy:
-- 1. Anyone can see non-SOS incidents (general safety)
-- 2. Only the victim or Security can see SOS incidents
CREATE POLICY "Incidents visibility policy" ON public.incidents
    FOR SELECT USING (
        type != 'SOS' 
        OR auth.uid() = user_id 
        OR (SELECT is_security FROM public.profiles WHERE id = auth.uid()) = true
    );

COMMIT;
