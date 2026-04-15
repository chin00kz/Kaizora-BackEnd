-- migration_v4_dept_registration.sql
-- 1. Update the trigger function to include department_id from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username, department_id)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    (new.raw_user_meta_data->>'department_id')::uuid
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add SELECT policy for departments to allow public access (read-only)
-- This allows unauthenticated users to see the department list during registration.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'departments' AND policyname = 'Departments are viewable by everyone'
    ) THEN
        CREATE POLICY "Departments are viewable by everyone" 
        ON public.departments 
        FOR SELECT 
        USING (true);
    END IF;
END $$;
