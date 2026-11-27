import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeCatalogVenue, decodeDrink, decodeSavedImpression, type ImpressionValue } from '../../../../shared/venue-contracts.ts';

export function catalogRepository(client: SupabaseClient) {
  return {
    async load(userId: string) {
      const [venues, drinks, impressions] = await Promise.all([
        pages(50, async offset => {
          const { data, error } = await client.rpc('get_venue_catalog', { p_offset: offset });
          if (error) throw error;
          if (!Array.isArray(data)) throw new Error('Invalid catalog response');
          return data.map(row => decodeCatalogVenue(row.venue));
        }),
        pages(500, async offset => {
          const { data, error } = await client.from('drinks').select('*').order('name').order('id').range(offset, offset + 499);
          if (error) throw error;
          if (!Array.isArray(data)) throw new Error('Invalid drink response');
          return data.map(decodeDrink);
        }),
        pages(500, async offset => {
          const { data, error } = await client.from('venue_impressions').select('*').eq('user_id', userId)
            .order('bar_id').range(offset, offset + 499);
          if (error) throw error;
          if (!Array.isArray(data)) throw new Error('Invalid impression response');
          return data.map(row => decodeSavedImpression(row, userId));
        }),
      ]);
      return { venues: [...new Map(venues.map(row => [row.id,row])).values()],
        drinks: [...new Map(drinks.map(row => [row.id,row])).values()],
        impressions: [...new Map(impressions.map(row => [row.bar_id,row])).values()] };
    },
    async save(userId: string, barId: string, impression: ImpressionValue) {
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      if (auth.user?.id !== userId) throw new Error('Account changed');
      const { data, error } = await client.from('venue_impressions').upsert({ user_id: userId, bar_id: barId, impression },
        { onConflict: 'user_id,bar_id' }).select('*').single();
      if (error) throw error;
      const row = decodeSavedImpression(data, userId);
      if (row.bar_id !== barId || row.impression !== impression) throw new Error('Mismatched impression response');
      return row;
    },
  };
}

async function pages<T>(size: number, read: (offset: number) => Promise<T[]>) {
  const all: T[] = [];
  for (let offset = 0; ; offset += size) {
    const rows = await read(offset);
    all.push(...rows);
    if (rows.length < size) return all;
  }
}
