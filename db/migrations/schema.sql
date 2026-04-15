-- Kaizora Database Schema

-- 1. Profiles Table (Extends Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  username TEXT UNIQUE,
  role TEXT CHECK (role IN ('employee', 'management', 'admin', 'superadmin')) DEFAULT 'employee',
  is_banned BOOLEAN DEFAULT FALSE,
  department_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Departments Table
CREATE TABLE departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Kaizens Table
CREATE TABLE kaizens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  status TEXT CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'revision_requested')) DEFAULT 'pending',
  impact_level TEXT CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Comments Table
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kaizen_id UUID REFERENCES kaizens(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Notifications Table
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kaizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Superadmin hardening: Block any UPDATE or DELETE on the superadmin account at DB level
-- This trigger fires BEFORE any update/delete on the profiles table
CREATE OR REPLACE FUNCTION public.protect_superadmin()
RETURNS trigger AS $$
BEGIN
  -- If the target row is a superadmin and it is being modified/deleted by a different user
  IF OLD.role = 'superadmin' AND auth.uid() <> OLD.id THEN
    RAISE EXCEPTION 'Permission Denied: The Super Admin account is protected and cannot be modified.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER superadmin_update_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role = 'superadmin')
  EXECUTE PROCEDURE public.protect_superadmin();

CREATE TRIGGER superadmin_delete_guard
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role = 'superadmin')
  EXECUTE PROCEDURE public.protect_superadmin();

-- Link profiles to auth.users on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
