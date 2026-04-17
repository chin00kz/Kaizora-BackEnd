-- 1. System About Table
CREATE TABLE system_about (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Creator Profiles Table
CREATE TABLE creator_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    nickname TEXT,
    bio TEXT,
    phone_number TEXT,
    social_links JSONB DEFAULT '{}'::jsonb,
    photo_url TEXT,
    is_visible BOOLEAN DEFAULT TRUE,
    display_order INT,
    UNIQUE(profile_id)
);

-- Enable RLS
ALTER TABLE system_about ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "About content is public" ON system_about FOR SELECT USING (true);
CREATE POLICY "Creator profiles are public" ON creator_profiles FOR SELECT USING (true);

-- Only owners can update their creator profile
CREATE POLICY "Creators can update their own profile" 
ON creator_profiles FOR UPDATE 
USING (auth.uid() = profile_id);

-- Initial Content
INSERT INTO system_about (content) VALUES (
    'Kaizora is a state-of-the-art continuous improvement management platform engineered to revolutionize how organizations capture, evaluate, and implement innovative ideas. Built on the principles of Kaizen, Kaizora provides a seamless end-to-end workflow for tracking improvement initiatives from inception to measurable impact. Our mission is to democratize innovation, empowering every team member to contribute to organizational excellence through a data-driven, transparent, and rewarding process.'
);

-- Register initial creators based on IDs found
-- Madhushi
INSERT INTO creator_profiles (profile_id, nickname, display_order) 
VALUES ('18af7039-cfe6-411f-b1cd-30f476103802', 'Madhushi', 3);

-- Chanuka
INSERT INTO creator_profiles (profile_id, nickname, display_order) 
VALUES ('fe1dabbc-0600-43ec-962c-2a93efb1bf44', 'Chanuka', 2);

-- Dasuni
INSERT INTO creator_profiles (profile_id, nickname, display_order) 
VALUES ('5d8b0d61-59d4-4066-a356-9040f2e577c6', 'Dasuni', 1);
