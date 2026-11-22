import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeSavedImpression, type ImpressionValue } from '../../../shared/venue-contracts.ts';
import { currentUser, result } from './shared.ts';

export function impressionsService(client: SupabaseClient) {
  return {
    async listMyImpressions(offset = 0) {
      if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid offset');
      const userId = await currentUser(client);
      const rows = await result(client.from('venue_impressions').select('*').eq('user_id', userId)
        .order('bar_id').range(offset, offset + 499));
      if (!Array.isArray(rows)) throw new Error('Invalid impression response');
      return rows.map(row => decodeSavedImpression(row,userId));
    },
    async saveImpression(barId: string, impression: ImpressionValue) {
      if (!['liked','fine','disliked'].includes(impression)) throw new Error('Invalid impression');
      const userId = await currentUser(client);
      const row = await result(client.from('venue_impressions').upsert({ user_id: userId, bar_id: barId, impression },
        { onConflict: 'user_id,bar_id' }).select('*').single());
      return decodeSavedImpression(row,userId);
    },
  };
}
