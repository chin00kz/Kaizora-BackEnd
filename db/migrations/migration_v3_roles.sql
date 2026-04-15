-- 1. Migrate any existing 'management' users to 'hod'
UPDATE profiles 
SET role = 'hod' 
WHERE role = 'management';

-- 2. Update the role CHECK constraint
-- PostgreSQL doesn't allow easy modification of CHECK constraints, so we drop and recreate
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('employee', 'qdm', 'hod', 'admin', 'superadmin'));

-- 3. Verify current superadmin
-- (Optional but safe) Ensure chanuka.main@gmail.com is superadmin
UPDATE profiles 
SET role = 'superadmin' 
WHERE email = 'chanuka.main@gmail.com';
