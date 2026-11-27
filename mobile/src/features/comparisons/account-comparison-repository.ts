import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeSavedComparison } from '../../../../shared/venue-contracts.ts';
import { parseUuid, type PersonalComparison } from './comparison-state.ts';

export type ComparisonRequest = { id: string; winnerId: string; loserId: string };
function decode(value: unknown, userId: string): PersonalComparison {
  const row = decodeSavedComparison(value, userId);
  return { ...row, id: parseUuid(row.id)!, user_id: parseUuid(row.user_id)!,
    winner_bar_id: parseUuid(row.winner_bar_id)!, loser_bar_id: parseUuid(row.loser_bar_id)! };
}
export function accountComparisonRepository(client: SupabaseClient) {
  return {
    async load(userId: string) {
      const rows: PersonalComparison[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from('bar_comparisons').select('*').eq('user_id', userId)
          .order('created_at').order('id').range(offset, offset + 499);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Invalid comparison history');
        rows.push(...data.map(row => decode(row, userId)));
        if (data.length < 500) return [...new Map(rows.map(row => [row.id, row])).values()];
      }
    },
    async save(userId: string, request: ComparisonRequest) {
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      if (auth.user?.id !== userId) throw new Error('Account changed');
      const { data, error } = await client.rpc('submit_personal_comparison', {
        p_request_id: request.id, p_winner_bar_id: request.winnerId, p_loser_bar_id: request.loserId,
      }).single();
      if (error) throw error;
      const row = decode(data, userId);
      if (row.id !== request.id || row.winner_bar_id !== request.winnerId || row.loser_bar_id !== request.loserId)
        throw new Error('Mismatched comparison response');
      return row;
    },
  };
}
