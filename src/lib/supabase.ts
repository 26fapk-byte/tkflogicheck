import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

// True if Supabase is properly configured with custom, non-default credentials
export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your_project') &&
  supabaseUrl !== 'https://your_project.supabase.co'
);

// Graceful fallback helper if Supabase is partially setup or default is active
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Keep silent when Supabase env vars are not configured.
