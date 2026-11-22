import type { SupabaseClient } from '@supabase/supabase-js';
export async function currentUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in first');
  return data.user.id;
}
// Infer the complete response first. Auth responses are a success/error union,
// and inferring only `data` incorrectly excludes the nullable error branch.
export async function result<Response extends { data: unknown; error: unknown }>(
  request: PromiseLike<Response>,
): Promise<Response['data']> {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}
