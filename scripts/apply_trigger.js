import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  console.log('Running DB Fixes...');

  // 1. Drop trigger first (in case it exists)
  await supabase.rpc('invoke_sql', { sql: `DROP TRIGGER IF EXISTS superadmin_update_guard ON public.profiles;` });
  
  const sql = `
CREATE OR REPLACE FUNCTION public.protect_superadmin()
RETURNS trigger AS $$
BEGIN
  -- Prevent modifications by other users
  IF OLD.role = 'superadmin' AND auth.uid() <> OLD.id THEN
    RAISE EXCEPTION 'Permission Denied: The Super Admin account is protected and cannot be modified.';
  END IF;

  -- The Easter Egg: Silently ignore updates to the superadmin profile unless the override is active
  IF OLD.role = 'superadmin' AND TG_OP = 'UPDATE' THEN
    IF current_setting('app.bypass_lock', true) = 'true' THEN
      RETURN NEW;
    ELSE
      RETURN OLD;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_superadmin_override(_uid uuid, _full_name text)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.bypass_lock', 'true', true);
  UPDATE public.profiles SET full_name = _full_name WHERE id = _uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER superadmin_update_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role = 'superadmin')
  EXECUTE PROCEDURE public.protect_superadmin();
  `;

  // We can't run raw DDL from client easily unless passing it via postgrest RPC? 
  // Wait, postgrest cannot execute arbitrary SQL unless there's an invoke_sql RPC or similar.
}

fix();
