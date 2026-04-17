-- Migration: QDM Buff - Scoring & Performance Tracking

-- 1. Add score and review metadata to kaizens
ALTER TABLE public.kaizens 
ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 10),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- 2. Ensure reviewed_by uses profiles
-- (The column already exists but we ensure it is properly linked)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kaizens' AND column_name='reviewed_by') THEN
        ALTER TABLE public.kaizens ADD COLUMN reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Initialize scores for existing approved kaizens to a baseline (e.g. 5)
UPDATE public.kaizens 
SET score = 5 
WHERE status = 'approved' AND score = 0;
