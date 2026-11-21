import type { SupabaseClient } from '@supabase/supabase-js';
import { currentUser, result } from './shared.ts';
import { rating } from '../logic/validation.ts';
export function bathroomsService(client: SupabaseClient) {
  return {
    async saveBathroomReview(barId: string, cleanliness: number,
      accessibility: number | null = null, waitTime: number | null = null) {
      rating(cleanliness);
      if (accessibility !== null) rating(accessibility);
      if (waitTime !== null) rating(waitTime);
      return result(client.from('bathroom_reviews').upsert({ bar_id: barId,
        user_id: await currentUser(client), cleanliness, accessibility, wait_time: waitTime },
        { onConflict: 'bar_id,user_id' }));
    },
    getBathroomSummary: (barId: string) => result(client.rpc('get_bathroom_summary', { p_bar_id: barId }))
  };
}
