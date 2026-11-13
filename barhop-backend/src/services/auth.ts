import type { SupabaseClient } from '@supabase/supabase-js';
import { currentUser, result } from './shared.ts';
import { text } from '../logic/validation.ts';
export function authService(client: SupabaseClient) {
  return {
    signUp: (email: string, password: string, username: string) => result(client.auth.signUp({
      email, password, options: { data: { username: text(username, 40) } }
    })),
    signIn: (email: string, password: string) => result(client.auth.signInWithPassword({ email, password })),
    async signOut() { const { error } = await client.auth.signOut(); if (error) throw error; },
    async getMyProfile() {
      return result(client.from('profiles').select('*').eq('id', await currentUser(client)).single());
    },
    async updateMyProfile(username: string, language: 'en' | 'it') {
      return result(client.from('profiles').update({ username: text(username, 40), preferred_language: language })
        .eq('id', await currentUser(client)).select().single());
    }
  };
}
