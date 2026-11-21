import type { SupabaseClient } from '@supabase/supabase-js';
export async function currentUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in first');
  return data.user.id;
}
export async function result<T>(request: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}
