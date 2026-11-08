import type { SupabaseClient } from '@supabase/supabase-js';
import { currentUser, result } from './shared.ts';
import { calculateRankings, type Comparison } from '../logic/eloRanking.ts';
export function rankingsService(client: SupabaseClient) {
  return {
    async submitComparison(winnerBarId: string, loserBarId: string) {
      if (winnerBarId === loserBarId) throw new Error('Choose two different bars');
      return result(client.from('bar_comparisons').insert({ user_id: await currentUser(client),
        winner_bar_id: winnerBarId, loser_bar_id: loserBarId }));
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
