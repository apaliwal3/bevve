import type { SupabaseClient } from '@supabase/supabase-js';
import { currentUser, result } from './shared.ts';
import { price } from '../logic/validation.ts';
export function drinksService(client: SupabaseClient) {
  return {
    listDrinks: () => result(client.from('drinks').select('*').order('name')),
    async submitDrinkPrice(barId: string, drinkId: string, priceCents: number, currency = 'EUR') {
      price(priceCents);
      if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Use a three-letter currency code');
      return result(client.from('drink_prices').insert({ bar_id: barId, drink_id: drinkId,
        price_cents: priceCents, currency, submitted_by: await currentUser(client) }));
    },
    // Returns the newest observation per venue, for the exact drink and currency.
    // Observation timestamps are retained; no automatic currency conversion.
    async compareDrinkPrices(drinkId: string, barIds: string[], currency = 'EUR') {
      if (barIds.length < 2 || barIds.length > 20) throw new Error('Choose 2–20 bars');
      return result(client.rpc('compare_drink_prices', {
        p_drink_id: drinkId, p_bar_ids: barIds, p_currency: currency
      }));
    }
  };
}
