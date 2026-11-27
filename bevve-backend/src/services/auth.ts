import type { SupabaseClient } from '@supabase/supabase-js';
import { currentUser, result } from './shared.ts';
import { text } from '../logic/validation.ts';
import { resetAccountPassword, type PasswordResetValues } from '../../../shared/password-reset.ts';
import { requestPasswordRecovery, updateRecoveredPassword, type RecoveredPasswordValues } from '../../../shared/password-recovery.ts';
export function authService(client: SupabaseClient) {
  return {
    signUp: (email: string, password: string, username: string) => result(client.auth.signUp({
      email, password, options: { data: { username: text(username, 40) } }
    })),
    signIn: (email: string, password: string) => result(client.auth.signInWithPassword({ email, password })),
    resetPassword: (values: PasswordResetValues) => resetAccountPassword(client, values),
    requestPasswordRecovery: (email: string, redirectTo: string) => requestPasswordRecovery(client, email, redirectTo),
    async completePasswordRecovery(values: RecoveredPasswordValues) {
      await updateRecoveredPassword(client, values, await currentUser(client));
    },
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
