import type { SupabaseClient } from '@supabase/supabase-js';
import { currentUser } from './shared.ts';
import { createSafetyRepository } from '../../../shared/safety-repository.ts';
import type { IncidentRequest } from '../../../shared/safety-contracts.ts';
export function safetyService(client: SupabaseClient) {
  const repository = createSafetyRepository(client);
  return {
    submitIncident: async (request: IncidentRequest) => repository.submit(await currentUser(client), request),
    getMyIncidentReports: async () => repository.load(await currentUser(client)),
    getModerationQueue: async () => repository.loadQueue(await currentUser(client)),
    moderateIncident: (reportId: string, decision: 'approved' | 'rejected', publicSummary: string | null = null) =>
      currentUser(client).then(owner => repository.moderate(owner, { id: reportId, decision, summary: publicSummary })),
    getPublishedIncidents: repository.loadPublic,
  };
}
