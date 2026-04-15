-- migration_v5_approval.sql
-- 1. Add is_approved column to profiles (default FALSE for new users)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- 2. Approve all existing users so nobody gets locked out
UPDATE public.profiles 
SET is_approved = TRUE 
WHERE is_approved IS NULL OR is_approved = FALSE;

-- 3. Update the trigger so new self-registered users are NOT approved
--    (Admins who create users via the dashboard will be set to true manually)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username, department_id, is_approved)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    (new.raw_user_meta_data->>'department_id')::uuid,
    FALSE  -- All self-registered users require admin approval
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
