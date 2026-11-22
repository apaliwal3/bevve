import type { SupabaseClient } from '@supabase/supabase-js';
import { currentUser, result } from './shared.ts';
import { calculateRankings, type Comparison } from '../logic/eloRanking.ts';
import { decodeSavedComparison } from '../../../shared/venue-contracts.ts';
export function rankingsService(client: SupabaseClient) {
  return {
    // Generate requestId once per explicit choice and reuse it for retries.
    async submitComparison(winnerBarId: string, loserBarId: string, requestId: string) {
      if (winnerBarId === loserBarId) throw new Error('Choose two different bars');
      const userId = await currentUser(client);
      const data = await result(client.rpc('submit_personal_comparison', {
        p_request_id: requestId, p_winner_bar_id: winnerBarId, p_loser_bar_id: loserBarId,
      }).single());
      const row = decodeSavedComparison(data, userId);
      if (row.id !== requestId || row.winner_bar_id !== winnerBarId || row.loser_bar_id !== loserBarId)
        throw new Error('Mismatched comparison response');
      return row;
    },
    async getMyRankings() {
      const userId = await currentUser(client);
      const comparisons: Comparison[] = [];
      // Page through all comparisons; PostgREST otherwise limits result size.
      for (let offset = 0; ; offset += 500) {
        const rows = await result(client.from('bar_comparisons')
          .select('id,winner_bar_id,loser_bar_id,created_at').eq('user_id', userId)
          .order('created_at').order('id').range(offset, offset + 499));
        comparisons.push(...(rows ?? []));
        if (!rows || rows.length < 500) break;
      }
      return calculateRankings(comparisons);
    }
  };
}
