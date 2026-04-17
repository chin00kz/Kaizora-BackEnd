-- Migration: Create system_logs table for Live Logger

CREATE TABLE IF NOT EXISTS public.system_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status INTEGER,
    user_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Optimization: Allow anyone to read logs (protected by API role check), only system can log
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System logs are viewable by superadmins"
ON public.system_logs FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'superadmin'
  )
);

-- Initialize debug mode setting if not exists
INSERT INTO public.system_settings (key, value)
VALUES ('api_debug_mode', 'false')
ON CONFLICT (key) DO NOTHING;
