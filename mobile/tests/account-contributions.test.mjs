import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountContributionStore, contributionKey } from '../src/features/contributions/account-contribution-store.ts';
import { accountContributionRepository } from '../src/features/contributions/account-contribution-repository.ts';
import { decodeBathroomReview, decodeCrowdReport, decodeDrinkPrice } from '../../shared/contribution-contracts.ts';
import { selectProfileContributions } from '../src/features/profile/profile-activity.ts';
import { catalogVenue } from '../src/features/catalog/catalog-adapters.ts';
import { userId,otherUserId,barId,at,venue,drink } from './helpers/catalog-fixtures.mjs';

const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const empty=()=>({crowds:[],bathrooms:[],prices:[]});
const catalog={status:'ready',venues:[venue()],drinks:[drink]};
const crowd={kind:'crowd',barId,level:3};
const bathroom={kind:'bathroom',barId,cleanliness:4,accessibility:3,wait_time:5};
const price={kind:'price',barId,drinkId:drink.id,priceCents:650};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function result(request,overrides={}){
  const input=request.input;
  if(input.kind==='crowd')return{kind:'crowd',row:{id:request.id,user_id:userId,bar_id:barId,level:input.level,created_at:at,...overrides}};
  if(input.kind==='bathroom')return{kind:'bathroom',row:{id:id(1),user_id:userId,bar_id:barId,cleanliness:input.cleanliness,accessibility:input.accessibility,wait_time:input.wait_time,created_at:at,updated_at:at,...overrides}};
  return{kind:'price',row:{id:request.id,submitted_by:userId,bar_id:barId,drink_id:input.drinkId,price_cents:input.priceCents,currency:'EUR',observed_at:at,...overrides}};
}
function setup(repository,user=userId){
  let next=100,invalidations=0;
  const store=createAccountContributionStore(user,repository,()=>id(++next),()=>invalidations++);
  store.setCatalog(catalog);const stop=store.start();
  return{store,stop,get invalidations(){return invalidations;}};
}

test('contribution load errors remain unavailable until retry, without fixture fallback',async()=>{
  let offline=true;
  const {store,stop}=setup({load:async()=>{if(offline)throw Error('offline');return empty();},save:async()=>{throw Error('unused');}});await tick();
  assert.equal(store.getSnapshot().status,'error');assert.deepEqual(store.getSnapshot().crowds,[]);
  await assert.rejects(store.submit(crowd,0),/unavailable/);offline=false;await store.refresh();assert.equal(store.getSnapshot().status,'ready');stop();
});

for(const input of [crowd,bathroom,price])test(`${input.kind}: rapid submissions coalesce and update only after confirmation`,async()=>{
  const gate=deferred();let calls=0,request;
  const ui=setup({load:async()=>empty(),save:async(_user,value)=>{calls++;request=value;return gate.promise;}});await tick();
  const first=ui.store.submit(input,0);assert.equal(ui.store.submit(input,0),first);assert.equal(calls,1);
  assert.equal(ui.store.getSnapshot().operations[contributionKey(input)].saving,true);
  assert.deepEqual(ui.store.getSnapshot().crowds,[]);assert.deepEqual(ui.store.getSnapshot().bathrooms,[]);assert.deepEqual(ui.store.getSnapshot().prices,[]);
  gate.resolve(result(request));await first;assert.equal(ui.invalidations,1);
  const operation=ui.store.getSnapshot().operations[contributionKey(input)];assert.equal(operation.version,1);assert.equal(operation.saved,true);
  await assert.rejects(ui.store.submit(input,0),/Stale/);ui.stop();
});

for(const input of [crowd,bathroom,price])test(`${input.kind}: failed saves keep the original request, lock different data and reuse the request on retry`,async()=>{
  let fail=true;const requests=[];
  const {store,stop}=setup({load:async()=>empty(),save:async(_user,request)=>{requests.push(request);if(fail)throw Error('lost response');return result(request);}});await tick();
  await assert.rejects(store.submit(input,0),/lost/);const key=contributionKey(input),op=store.getSnapshot().operations[key];
  assert.equal(op.error,true);assert.deepEqual(op.request.input,input);
  const changed=input.kind==='crowd'?{...input,level:5}:input.kind==='bathroom'?{...input,cleanliness:1}:{...input,priceCents:850};
  await assert.rejects(store.submit(changed,0),/pending contribution/);
  fail=false;await store.retry(key,op.request.id);assert.deepEqual(requests[0],requests[1]);assert.equal(store.getSnapshot().operations[key].request,null);stop();
});

test('history reload preserves all reports/prices, edits one bathroom row and feeds Profile with database servings',async()=>{
  const persisted=empty();let stamp=0;
  const repository={load:async()=>structuredClone(persisted),save:async(_user,request)=>{
    const saved=result(request,{...(request.input.kind==='bathroom'?{updated_at:new Date(Date.parse(at)+ ++stamp).toISOString()}:{})});
    if(saved.kind==='crowd')persisted.crowds.push(saved.row);if(saved.kind==='price')persisted.prices.push(saved.row);if(saved.kind==='bathroom')persisted.bathrooms=[saved.row];return saved;
  }};
  const first=setup(repository);await tick();
  for(const input of [crowd,price,bathroom])await first.store.submit(input,0);
  for(const input of [{...crowd,level:5},{...price,priceCents:750},{...bathroom,cleanliness:5}])await first.store.submit(input,1);
  first.stop();const second=setup(repository);await tick();const state=second.store.getSnapshot();
  assert.equal(state.crowds.length,2);assert.equal(state.prices.length,2);assert.equal(state.bathrooms.length,1);assert.equal(state.bathrooms[0].cleanliness,5);
  assert.deepEqual(state.operations,{});
  const activity=selectProfileContributions({impressions:{},crowdReports:state.crowds,bathroomReviews:state.bathrooms,priceObservations:state.prices},userId,[catalogVenue(venue())],[drink]);
  assert.deepEqual(activity.counts,{impressions:0,crowdReports:2,bathroomReviews:1,priceObservations:2});assert.equal(activity.prices[0].servingMl,330);assert.equal(activity.prices[0].drinkName,drink.name);second.stop();
});

test('refresh recovers a committed append after a lost response, without resubmitting or double-counting',async()=>{
  const persisted=empty();let calls=0;
  const {store,stop}=setup({load:async()=>persisted,save:async(_user,request)=>{calls++;persisted.crowds=[result(request).row];throw Error('lost');}});await tick();
  await assert.rejects(store.submit(crowd,0));await store.refresh();assert.equal(store.getSnapshot().crowds.length,1);assert.equal(store.getSnapshot().operations[contributionKey(crowd)].saved,true);assert.equal(calls,1);stop();
});

test('stale refreshes preserve writes confirmed during the read and accept later bathroom edits from another device',async()=>{
  const stale=deferred();let loads=0;
  const persisted=empty();
  const {store,stop}=setup({load:async()=>++loads===2?stale.promise:structuredClone(persisted),save:async(_user,request)=>result(request)});await tick();
  const refresh=store.refresh();await store.submit(bathroom,0);await store.submit(price,0);stale.resolve(empty());await refresh;
  assert.equal(store.getSnapshot().bathrooms[0].cleanliness,4);assert.equal(store.getSnapshot().prices.length,1);
  persisted.bathrooms=[result({id:id(100),input:bathroom},{cleanliness:2,updated_at:'2026-11-23T00:00:00Z'}).row];await store.refresh();assert.equal(store.getSnapshot().bathrooms[0].cleanliness,2);stop();
});

test('account switches ignore late loads/saves and effect replay leaves uncertain writes retryable',async()=>{
  const gate=deferred();let request,calls=0;
  const a=setup({load:async()=>empty(),save:async(_user,value)=>{request=value;if(++calls===1)return gate.promise;return result(value);}});await tick();
  const save=a.store.submit(crowd,0);a.stop();const end=a.store.start();await tick();assert.equal(a.store.getSnapshot().operations[contributionKey(crowd)].saving,false);
  gate.resolve(result(request));await assert.rejects(save,/Account changed/);await a.store.retry(contributionKey(crowd),request.id);assert.equal(a.store.getSnapshot().crowds.length,1);end();
  const other=setup({load:async()=>empty(),save:async()=>{throw Error('unused');}},otherUserId);await tick();assert.deepEqual(other.store.getSnapshot().crowds,[]);other.stop();
});

test('invalid venue, foreign fixture drink, fractional scores and unsupported price amounts cannot write',async()=>{
  let writes=0;const {store,stop}=setup({load:async()=>empty(),save:async()=>{writes++;}});await tick();
  for(const input of [{...crowd,barId:id(99)},{...crowd,level:1.5},{...bathroom,accessibility:null},{...price,drinkId:id(9)},{...price,priceCents:0},{...price,priceCents:10001}])await assert.rejects(store.submit(input,0),/unavailable/);
  assert.equal(writes,0);stop();
});

test('runtime decoders reject other owners and malformed fields while keeping legacy null bathroom categories',()=>{
  const review=result({id:id(10),input:bathroom},{accessibility:null,wait_time:null}).row;
  assert.equal(decodeBathroomReview(review,userId).accessibility,null);
  const crowdRow=result({id:id(10),input:crowd}).row,priceRow=result({id:id(10),input:price}).row;
  for(const [decode,row] of [[decodeBathroomReview,review],[decodeCrowdReport,crowdRow],[decodeDrinkPrice,priceRow]]){
    assert.throws(()=>decode({...row,user_id:otherUserId,submitted_by:otherUserId},userId));assert.throws(()=>decode({...row,id:'fixture'},userId));
  }
  assert.throws(()=>decodeCrowdReport({...crowdRow,created_at:'bad'},userId));assert.throws(()=>decodeDrinkPrice({...priceRow,currency:'USD'},userId));
});

test('repository paginates each history beyond 500 and validates every owned row',async()=>{
  const calls=[];let foreign=false;
  function rows(kind,offset){return Array.from({length:offset===0?500:1},(_,i)=>result({id:id(offset+i+1000),input:kind==='crowd'?crowd:kind==='bathroom'?bathroom:price},kind==='bathroom'?{id:id(offset+i+1000)}:{}).row);}
  const repo=accountContributionRepository({from(table){const kind=table==='crowd_reports'?'crowd':'bathroom';const query={select(){return query;},eq(key,value){assert.equal(key,'user_id');assert.equal(value,userId);return query;},order(){return query;},async range(start,end){calls.push([table,start,end]);return{data:rows(kind,start),error:null};}};return query;},
    rpc(name,{p_offset}){assert.equal(name,'get_my_drink_prices');calls.push([name,p_offset]);return Promise.resolve({data:rows('price',p_offset).map(row=>foreign?{...row,submitted_by:otherUserId}:row),error:null});}});
  const data=await repo.load(userId);assert.equal(data.crowds.length,501);assert.equal(data.bathrooms.length,501);assert.equal(data.prices.length,501);
  assert.ok(calls.some(call=>call[0]==='get_my_drink_prices'&&call[1]===500));foreign=true;await assert.rejects(repo.load(userId),/Invalid price/);
});

for(const input of [crowd,bathroom,price])test(`repository ${input.kind}: binds the initiating account and sends no client timestamps or serving overrides`,async()=>{
  const request={id:id(500),input};let owner=userId,payload,header,invalid=false;
  const query={select(){return query;},upsert(value,options){payload=value;assert.deepEqual(options,{onConflict:'bar_id,user_id'});return query;},setHeader(name,value){assert.equal(name,'Authorization');header=value;return query;},async single(){return {data:result(request,invalid?{bar_id:id(999)}:{}).row,error:null};}};
  const repo=accountContributionRepository({auth:{getUser:async()=>({data:{user:{id:owner}},error:null}),getSession:async()=>({data:{session:{user:{id:owner},access_token:'test-session-token'}},error:null})},
    from(table){assert.equal(table,'bathroom_reviews');return query;},rpc(name,args){assert.equal(name,input.kind==='crowd'?'submit_crowd_report':'submit_drink_price');payload=args;return query;}});
  await repo.save(userId,request);assert.equal(header,'Bearer test-session-token');assert.ok(!Object.hasOwn(payload,'created_at'));assert.ok(!Object.hasOwn(payload,'observed_at'));assert.ok(!Object.hasOwn(payload,'serving_ml'));
  if(input.kind==='price')assert.equal(payload.p_drink_id,drink.id);
  invalid=true;await assert.rejects(repo.save(userId,request),/Mismatched/);owner=otherUserId;await assert.rejects(repo.save(userId,request),/Account changed/);
});
