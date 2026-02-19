import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jtynyaaqrcyhysaxgxbp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YDqv7bPuKSuCtausLXk2WA_VRiYQ0pC';

declare global {
	// eslint-disable-next-line no-var
	var __supabase: SupabaseClient | undefined;
}

// Ensure a single Supabase client instance (safe for Fast Refresh / HMR)
export const supabase: SupabaseClient = globalThis.__supabase ?? (globalThis.__supabase = createClient(
  SUPABASE_URL, 
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
));
