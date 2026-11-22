import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeBathroomReview, decodeCrowdReport, decodeDrinkPrice, matchesContribution, validContributionInput,
  type ContributionRequest, type ContributionResult } from '../../../../shared/contribution-contracts.ts';

async function pages<T>(read: (offset: number) => Promise<T[]>) {
  const all: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const rows = await read(offset); all.push(...rows);
    if (rows.length < 500) return all;
  }
}
export function accountContributionRepository(client: SupabaseClient) {
  return {
    async load(userId: string) {
      const owned = <T>(table: string, order: string, decode: (value: unknown, user: string) => T) => pages(async offset => {
        const { data, error } = await client.from(table).select('*').eq('user_id', userId).order(order).order('id').range(offset,offset+499);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Invalid contribution history');
        return data.map(row => decode(row,userId));
      });
      const [crowds,bathrooms,prices] = await Promise.all([
        owned('crowd_reports','created_at',decodeCrowdReport),
        owned('bathroom_reviews','updated_at',decodeBathroomReview),
        pages(async offset => {
          const { data,error } = await client.rpc('get_my_drink_prices',{ p_offset: offset });
          if (error) throw error;
          if (!Array.isArray(data)) throw new Error('Invalid price history');
          return data.map(row => decodeDrinkPrice(row,userId));
        }),
      ]);
      return { crowds,bathrooms,prices };
    },
    async save(userId: string, request: ContributionRequest): Promise<ContributionResult> {
      if (!validContributionInput(request.input)) throw new Error('Invalid contribution');
      const { data:auth,error:authError } = await client.auth.getUser();
      if (authError) throw authError;
      if (auth.user?.id !== userId) throw new Error('Account changed');
      const { data:sessionData,error:sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (sessionData.session?.user.id !== userId) throw new Error('Account changed');
      // Bind this write to the account that initiated it, even if the shared
      // Supabase client switches sessions while preparing the HTTP request.
      const authorization = `Bearer ${sessionData.session.access_token}`;
      const input = request.input;
      let result: ContributionResult;
      if (input.kind === 'bathroom') {
        const { data,error } = await client.from('bathroom_reviews').upsert({ user_id:userId,bar_id:input.barId,
          cleanliness:input.cleanliness,accessibility:input.accessibility,wait_time:input.wait_time },{onConflict:'bar_id,user_id'}).select('*').setHeader('Authorization',authorization).single();
        if (error) throw error;
        result={kind:'bathroom',row:decodeBathroomReview(data,userId)};
      } else if (input.kind === 'crowd') {
        const { data,error } = await client.rpc('submit_crowd_report',{p_request_id:request.id,p_bar_id:input.barId,p_level:input.level}).setHeader('Authorization',authorization).single();
        if (error) throw error;
        result={kind:'crowd',row:decodeCrowdReport(data,userId)};
      } else {
        const { data,error } = await client.rpc('submit_drink_price',{p_request_id:request.id,p_bar_id:input.barId,p_drink_id:input.drinkId,p_price_cents:input.priceCents}).setHeader('Authorization',authorization).single();
        if (error) throw error;
        result={kind:'price',row:decodeDrinkPrice(data,userId)};
      }
      if (!matchesContribution(result,request)) throw new Error('Mismatched contribution response');
      return result;
    },
  };
}
