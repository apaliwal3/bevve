import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountComparisonStore } from '../src/features/comparisons/account-comparison-store.ts';
import { accountComparisonRepository } from '../src/features/comparisons/account-comparison-repository.ts';
import { decodeSavedComparison } from '../../shared/venue-contracts.ts';
import { userId, otherUserId, barId, at, venue, impression } from './helpers/catalog-fixtures.mjs';

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = [barId, ...[2,3,4,5].map(id)];
const catalog = { venues: ids.map(value => venue({id:value})), impressions: Object.fromEntries(ids.map(value => [value,impression('fine',{bar_id:value})])) };
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes,no) => {resolve=yes;reject=no;});return {promise,resolve,reject}; }
function row(request, overrides = {}) { return { id:request.id,user_id:userId,winner_bar_id:request.winnerId,loser_bar_id:request.loserId,created_at:at,...overrides }; }
function setup(repository, user = userId) {
  let next = 100;
  const store=createAccountComparisonStore(user,repository,()=>id(++next));
  store.setCatalog(catalog); const stop=store.start();
  return {store,stop};
}
function token(store) { const batch=store.getSnapshot().batches[barId];return {barId,batchId:batch.id,round:batch.round}; }

test('restoration retries after errors; opening and beginning a batch create no votes', async () => {
  let offline=true,writes=0;
  const {store,stop}=setup({load:async()=>{if(offline)throw Error('offline');return [];},save:async()=>{writes++;}});
  await tick();assert.equal(store.getSnapshot().status,'error');
  store.begin(barId,null);assert.deepEqual(store.getSnapshot().batches,{});
  offline=false;await store.refresh();store.begin(barId,null);
  const batch=store.getSnapshot().batches[barId];
  assert.equal(batch.opponents.length,3);assert.equal(new Set(batch.opponents).size,3);assert.ok(!batch.opponents.includes(barId));
  assert.equal(writes,0);assert.deepEqual(store.rankings(),[]);
  store.begin(barId,null);assert.equal(store.getSnapshot().batches[barId],batch);
  stop();
});

test('only saved database experience is eligible and skipped prompts cannot create rankings', async () => {
  let writes=0;
  const {store,stop}=setup({load:async()=>[],save:async()=>{writes++;}});await tick();
  store.setCatalog({venues:catalog.venues,impressions:{[barId]:catalog.impressions[barId],[ids[1]]:catalog.impressions[ids[1]],[ids[2]]:impression('liked',{bar_id:ids[2],user_id:otherUserId})}});
  store.begin(barId,null);assert.deepEqual(store.getSnapshot().batches[barId].opponents,[ids[1]]);
  const stale=token(store);store.skip(stale);store.skip(stale);assert.equal(store.getSnapshot().batches[barId].round,1);
  assert.equal(writes,0);assert.deepEqual(store.rankings(),[]);stop();
});

test('rapid choices coalesce and stale choice/skip callbacks cannot consume the next prompt', async () => {
  const saving=deferred();let calls=0,request;
  const {store,stop}=setup({load:async()=>[],save:async(_user,value)=>{request=value;calls++;return saving.promise;}});await tick();store.begin(barId,null);
  const stale=token(store),opponent=store.getSnapshot().batches[barId].opponents[0];
  const first=store.choose(stale,barId);assert.equal(store.choose(stale,barId),first);
  await assert.rejects(store.choose(stale,opponent),/pending choice/);
  store.skip(stale,true);assert.equal(store.getSnapshot().batches[barId].round,0);assert.equal(calls,1);
  assert.deepEqual(store.rankings(),[]);saving.resolve(row(request));await first;
  assert.equal(store.getSnapshot().history.length,1);assert.equal(store.rankings().length,2);
  store.skip(stale);await assert.rejects(store.choose(stale,barId),/unavailable/);
  assert.equal(store.getSnapshot().batches[barId].round,1);
  store.skip(token(store),true);assert.equal(store.getSnapshot().history.length,1);stop();
});

test('a response lost after commit retries the same request; refreshed history also recovers the prompt', async () => {
  let saved=[],requests=[],fail=true;
  const repository={load:async()=>saved,save:async(_user,request)=>{requests.push(request);saved=[row(request)];if(fail)throw Error('lost response');return saved[0];}};
  const {store,stop}=setup(repository);await tick();store.begin(barId,null);const prompt=token(store);
  await assert.rejects(store.choose(prompt,barId),/lost response/);
  assert.equal(store.getSnapshot().batches[barId].error,true);assert.equal(store.getSnapshot().history.length,0);
  fail=false;await store.choose(prompt,barId);assert.deepEqual(requests[0],requests[1]);
  assert.equal(store.getSnapshot().history.length,1);assert.equal(store.getSnapshot().batches[barId].round,1);
  fail=true;await assert.rejects(store.choose(token(store),barId));await store.refresh();
  assert.equal(store.getSnapshot().batches[barId].round,2);assert.equal(store.getSnapshot().history.length,2);stop();
});

test('server history survives a new store while unfinished batches reset; impressions never affect Elo', async () => {
  let saved=[];
  const repository={load:async()=>saved,save:async(_user,request)=>{const result=row(request);saved.push(result);return result;}};
  const first=setup(repository);await tick();first.store.begin(barId,null);await first.store.choose(token(first.store),barId);
  const before=first.store.rankings();first.stop();
  const second=setup(repository);await tick();assert.deepEqual(second.store.rankings(),before);assert.deepEqual(second.store.getSnapshot().batches,{});
  second.store.setCatalog({...catalog,impressions:{}});assert.deepEqual(second.store.rankings(),before);second.stop();
});

test('a stale refresh cannot discard acknowledged votes, and account switches ignore late saves', async () => {
  const stale=deferred(),saving=deferred();let loads=0,request;
  const a=setup({load:async()=>++loads===2?stale.promise:[],save:async(_user,value)=>row(value)});await tick();a.store.begin(barId,null);
  const refresh=a.store.refresh();await a.store.choose(token(a.store),barId);stale.resolve([]);await refresh;
  assert.equal(a.store.getSnapshot().history.length,1);a.stop();
  const old=setup({load:async()=>[],save:async(_user,value)=>{request=value;return saving.promise;}});await tick();old.store.begin(barId,null);
  const save=old.store.choose(token(old.store),barId);old.stop();
  const next=setup({load:async()=>[],save:async()=>{throw Error('unused');}},otherUserId);await tick();
  saving.resolve(row(request));await assert.rejects(save,/Account changed/);assert.deepEqual(next.store.getSnapshot().history,[]);next.stop();
});

test('effect replay ignores old responses and leaves uncertain writes retryable', async () => {
  const saving=deferred();let request,calls=0;
  const {store,stop}=setup({load:async()=>[],save:async(_user,value)=>{request=value;if(++calls===1)return saving.promise;return row(value);}});
  await tick();store.begin(barId,null);const prompt=token(store);const first=store.choose(prompt,barId);
  stop();const end=store.start();await tick();assert.equal(store.getSnapshot().batches[barId].saving,false);
  saving.resolve(row(request));await assert.rejects(first,/Account changed/);
  await store.choose(prompt,barId);assert.equal(store.getSnapshot().history.length,1);end();
});

test('comparison decoder rejects malformed data, foreign ownership, invalid timestamps and self comparisons', () => {
  const valid=row({id:id(10),winnerId:barId,loserId:ids[1]});
  assert.deepEqual(decodeSavedComparison(valid,userId),valid);
  for(const invalid of [{...valid,user_id:otherUserId},{...valid,id:'fixture'},{...valid,created_at:'bad'},{...valid,loser_bar_id:barId},null])
    assert.throws(()=>decodeSavedComparison(invalid,userId),/Invalid comparison/);
});

test('repository pages beyond 500, scopes by owner, orders stably and rejects foreign rows', async () => {
  const ranges=[],orders=[],owners=[];let foreign=false;
  const query={select(){return query;},eq(key,value){owners.push([key,value]);return query;},order(key){orders.push(key);return query;},
    async range(start,end){ranges.push([start,end]);return {data:Array.from({length:start===0?500:1},(_,index)=>row({id:id(start+index+1000),winnerId:barId,loserId:ids[1]},{user_id:foreign?otherUserId:userId})),error:null};}};
  const repo=accountComparisonRepository({from:name=>{assert.equal(name,'bar_comparisons');return query;}});
  assert.equal((await repo.load(userId)).length,501);assert.deepEqual(ranges,[[0,499],[500,999]]);assert.deepEqual(orders,['created_at','id','created_at','id']);
  assert.ok(owners.every(([key,value])=>key==='user_id'&&value===userId));foreign=true;await assert.rejects(repo.load(userId),/Invalid comparison/);
});

test('RPC submission sends only its request and pair, verifies auth and validates the returned vote', async () => {
  const request={id:id(50),winnerId:barId,loserId:ids[1]};let account=userId,calls=0,invalid=false;
  const repo=accountComparisonRepository({auth:{getUser:async()=>({data:{user:{id:account}},error:null})},rpc(name,args){
    calls++;assert.equal(name,'submit_personal_comparison');assert.deepEqual(args,{p_request_id:request.id,p_winner_bar_id:barId,p_loser_bar_id:ids[1]});
    return {single:async()=>({data:row(request,invalid?{id:id(51)}:{}),error:null})};}});
  assert.deepEqual(await repo.save(userId,request),row(request));invalid=true;await assert.rejects(repo.save(userId,request),/Mismatched/);
  account=otherUserId;await assert.rejects(repo.save(userId,request),/Account changed/);assert.equal(calls,2);
});
