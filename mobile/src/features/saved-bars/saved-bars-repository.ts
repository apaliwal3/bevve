import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeSavedBar, type SavedBar } from '../../../../shared/saved-bar-contracts.ts';

export type SavedBarsRepository = {
  load(owner: string): Promise<readonly SavedBar[]>;
  setSaved(owner: string, barId: string, saved: boolean): Promise<SavedBar | null>;
};

export function savedBarsRepository(client: SupabaseClient): SavedBarsRepository {
  return {
    async load(owner) {
      const rows: SavedBar[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from('saved_bars').select('user_id,bar_id,created_at').eq('user_id', owner)
          .order('created_at', { ascending: false }).order('bar_id').range(offset, offset + 499);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Invalid saved bars');
        rows.push(...data.map(row => decodeSavedBar(row, owner)));
        if (data.length < 500) return rows;
      }
    },
    async setSaved(owner, barId, saved) {
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      if (auth.user?.id !== owner) throw new Error('Account changed');
      if (!saved) {
        const { error } = await client.from('saved_bars').delete().eq('user_id', owner).eq('bar_id', barId);
        if (error) throw error;
        return null;
      }
      const inserted = await client.from('saved_bars').insert({ user_id: owner, bar_id: barId }).select('user_id,bar_id,created_at').single();
      if (!inserted.error) return decodeSavedBar(inserted.data, owner);
      if (inserted.error.code !== '23505') throw inserted.error;
      // A retry or another device may already have saved it. Keep its original date.
      const { data, error } = await client.from('saved_bars').select('user_id,bar_id,created_at')
        .eq('user_id', owner).eq('bar_id', barId).single();
      if (error) throw error;
      return decodeSavedBar(data, owner);
    },
  };
}
