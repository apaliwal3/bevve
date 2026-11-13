import type { SupabaseClient } from '@supabase/supabase-js';
import { currentUser, result } from './shared.ts';
import { rating } from '../logic/validation.ts';
export function crowdService(client: SupabaseClient) {
  return {
    async submitCrowdReport(barId: string, level: number) {
      rating(level);
      return result(client.from('crowd_reports').insert({ bar_id: barId,
        user_id: await currentUser(client), level }));
    },
    getBarCrowd: (barId: string) => result(client.rpc('get_bar_crowd', { p_bar_id: barId }))
  };
}
