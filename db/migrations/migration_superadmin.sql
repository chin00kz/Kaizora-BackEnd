-- ============================================================
-- Kaizora Schema Migration - Apply in Supabase SQL Editor
-- ============================================================

-- Step 1: Update the role constraint to include 'superadmin'
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('employee', 'management', 'admin', 'superadmin'));

-- Step 2: Add missing columns (username, is_banned)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- Step 3: Create the superadmin protection trigger function
CREATE OR REPLACE FUNCTION public.protect_superadmin()
RETURNS trigger AS $$
BEGIN
  IF OLD.role = 'superadmin' AND auth.uid() <> OLD.id THEN
    RAISE EXCEPTION 'Permission Denied: The Super Admin account is protected and cannot be modified.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create triggers to guard superadmin from UPDATE by others
DROP TRIGGER IF EXISTS superadmin_update_guard ON public.profiles;
CREATE TRIGGER superadmin_update_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role = 'superadmin')
  EXECUTE PROCEDURE public.protect_superadmin();

-- Step 5: Block DELETE on superadmin by others
DROP TRIGGER IF EXISTS superadmin_delete_guard ON public.profiles;
CREATE TRIGGER superadmin_delete_guard
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role = 'superadmin')
  EXECUTE PROCEDURE public.protect_superadmin();

-- Done!
SELECT 'Migration applied successfully ✅' AS result;
