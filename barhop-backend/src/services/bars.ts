import type { SupabaseClient } from '@supabase/supabase-js';
import { result } from './shared.ts';
export function barsService(client: SupabaseClient) {
  return {
    listBars(search = '', offset = 0) {
      if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid offset');
      const term = search.trim().replace(/[\%_]/g, char => `\${char}`);
      return result(client.from('bars').select('*').ilike('name', `%${term}%`)
        .order('name').order('id').range(offset, offset + 49));
    },
    getBar: (id: string) => result(client.from('bars').select('*').eq('id', id).single()),
    getLanguages: (barId: string) => result(client.from('bar_languages').select('*').eq('bar_id', barId))
  };
}
