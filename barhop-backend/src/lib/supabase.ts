import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';

// Pass configuration in explicitly so this module can be used by Node or Expo.
// In Expo, supply a secure session storage adapter via options.auth.storage.
// Only supply a publishable key; never embed a service-role key in an app.
export function createBarHopClient(url: string, publishableKey: string,
  options?: SupabaseClientOptions<'public'>) {
  if (!url || !publishableKey) throw new Error('Supabase configuration is missing');
  return createClient(url, publishableKey, options);
}
