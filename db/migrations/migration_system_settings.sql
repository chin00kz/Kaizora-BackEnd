-- Migration: Create system_settings table for global platform configuration

CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Initialize default maintenance settings
INSERT INTO public.system_settings (key, value)
VALUES 
    ('maintenance_mode', '"none"'),
    ('maintenance_message', '"System is currently under scheduled maintenance. Please check back shortly."')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Everyone can read status, only admins can update
CREATE POLICY "System settings are viewable by everyone" 
ON public.system_settings FOR SELECT USING (true);

CREATE POLICY "Only admins and superadmins can update system settings" 
ON public.system_settings FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'superadmin')
  )
);
