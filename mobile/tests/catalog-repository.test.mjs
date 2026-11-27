import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogRepository } from '../src/features/catalog/catalog-repository.ts';
import { at, userId, otherUserId, barId, drink, venue, impression } from './helpers/catalog-fixtures.mjs';

test('the repository reads every catalog/owned-impression page and keeps backend identities', async () => {
  const calls=[];
  const id=n=>'10000000-0000-0000-0000-'+n.toString(16).padStart(12,'0');
  const allVenues=Array.from({ length: 51 },(_,n)=>venue({ id: id(n),name:'Venue '+n }));
  const allImpressions=Array.from({ length: 501 },(_,n)=>impression('liked',{ bar_id: id(n) }));
  const sdk={
    rpc: async (name,{p_offset})=>{ calls.push([name,p_offset]); return { data:allVenues.slice(p_offset,p_offset+50).map(venue=>({venue})),error:null }; },
    from(table) {
      const query={ select(){return query;},order(){return query;},eq(key,value){assert.equal(key,'user_id');assert.equal(value,userId);return query;},
        async range(start,end){calls.push([table,start,end]);return {data:table==='drinks'?[drink]:allImpressions.slice(start,end+1),error:null};} };
      return query;
    },
  };
  const result=await catalogRepository(sdk).load(userId);
  assert.equal(result.venues.length,51);
  assert.equal(result.impressions.length,501);
  assert.equal(result.drinks[0].serving_ml,330);
  assert.ok(calls.some(call=>call[0]==='get_venue_catalog'&&call[1]===50));
  assert.ok(calls.some(call=>call[0]==='venue_impressions'&&call[1]===500));
});

test('save checks the active account and sends no client timestamps or community eligibility', async () => {
  let payload;
  let owner=userId;
  const query={upsert(value,options){payload=value;assert.deepEqual(options,{onConflict:'user_id,bar_id'});return query;},select(){return query;},single:async()=>({data:impression('fine'),error:null})};
  const sdk={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},from:table=>{assert.equal(table,'venue_impressions');return query;}};
  const repository=catalogRepository(sdk);
  assert.equal((await repository.save(userId,barId,'fine')).updated_at,at);
  assert.deepEqual(payload,{user_id:userId,bar_id:barId,impression:'fine'});
  owner=otherUserId;
  await assert.rejects(repository.save(userId,barId,'liked'),/Account changed/);
});

test('query errors propagate instead of supplying fixture or empty results', async () => {
  const query={select(){return query;},order(){return query;},eq(){return query;},range:async()=>({data:[],error:null})};
  const repository=catalogRepository({rpc:async()=>({data:null,error:new Error('missing migration')}),from:()=>query});
  await assert.rejects(repository.load(userId),/missing migration/);
});
