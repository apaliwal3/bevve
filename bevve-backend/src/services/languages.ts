import type { SupabaseClient } from '@supabase/supabase-js';
import { createLanguageRepository } from '../../../shared/language-repository.ts';
import type { LanguageRequest } from '../../../shared/language-contracts.ts';
import { currentUser } from './shared.ts';

export function languagesService(client: SupabaseClient) {
  const repository = createLanguageRepository(client);
  return {
    getMySuggestions: async () => repository.load(await currentUser(client)),
    submitSuggestion: async (request: LanguageRequest) => repository.submit(await currentUser(client), request),
    getModerationQueue: async () => repository.loadQueue(await currentUser(client)),
    moderateSuggestion: async (id: string, decision: 'approved' | 'rejected') => repository.moderate(await currentUser(client), id, decision),
  };
}
