import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { sessionStorage } from './session-storage';
import { supabaseConfig } from './supabase-config';

const config = supabaseConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_KEY);
export const supabase = config ? createClient(config.url, config.key, {
  auth: { storage: sessionStorage, persistSession: true, autoRefreshToken: true,
    detectSessionInUrl: false },
}) : null;
