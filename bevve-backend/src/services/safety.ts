import type { SupabaseClient } from '@supabase/supabase-js';
import { currentUser, result } from './shared.ts';
import { text } from '../logic/validation.ts';
export function safetyService(client: SupabaseClient) {
  return {
    async submitIncident(barId: string, category: string, description: string, occurredAt: string | null = null) {
      return result(client.from('incident_reports').insert({ bar_id: barId,
        reporter_id: await currentUser(client), category: text(category, 80),
        description: text(description, 4000), occurred_at: occurredAt }));
    },
    getMyIncidentReports: () => result(client.from('incident_reports').select('*').order('created_at', { ascending: false })),
    // Database RPC checks the signed-in moderator role, then updates atomically.
    moderateIncident: (reportId: string, decision: 'approved' | 'rejected', publicSummary: string | null = null) =>
      result(client.rpc('moderate_incident', { p_report_id: reportId, p_decision: decision, p_summary: publicSummary })),
    getPublishedIncidents: (barId: string) => result(client.from('published_incidents')
      .select('*').eq('bar_id', barId).order('published_at', { ascending: false }))
  };
}
