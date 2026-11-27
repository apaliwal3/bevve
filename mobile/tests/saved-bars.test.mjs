import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSavedBarsStore } from '../src/features/saved-bars/saved-bars-store.ts';
import { decodeSavedBar } from '../../shared/saved-bar-contracts.ts';
import { userId,otherUserId,barId,at } from './helpers/catalog-fixtures.mjs';

const row=(extra={})=>({user_id:userId,bar_id:barId,created_at:at,...extra});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function setup(overrides={}){
  const requests=[];const repo={load:async()=>[],setSaved:async(owner,id,target)=>{requests.push([owner,id,target]);return target?row({bar_id:id}):null;},...overrides};
  const store=createSavedBarsStore(userId,repo);const stop=store.start();return{store,stop,requests};
}

test('saved-bar decoding rejects foreign owners, malformed IDs and invalid dates',()=>{
  assert.deepEqual(decodeSavedBar(row(),userId),row());
  for(const value of [null,row({user_id:otherUserId}),row({bar_id:'bad'}),row({created_at:'bad'})])assert.throws(()=>decodeSavedBar(value,userId));
});

test('account saves and removals only appear after confirmation, coalesce rapid taps and reload across sessions',async()=>{
  const result=deferred();let calls=0;const stored=[];
  const ui=setup({load:async()=>stored,setSaved:async()=>{calls++;await result.promise;stored.push(row());return row();}});await tick();
  const first=ui.store.setSaved(barId,true);assert.equal(ui.store.setSaved(barId,true),first);
  assert.equal(ui.store.getSnapshot().bars[barId],undefined);assert.equal(ui.store.getSnapshot().operations[barId].saving,true);
  await assert.rejects(ui.store.setSaved(barId,false),/progress/);await tick();assert.equal(calls,1);
  result.resolve();await first;assert.deepEqual(ui.store.getSnapshot().bars[barId],row());
  await ui.store.setSaved(barId,true);assert.equal(calls,1);ui.stop();
  const restored=setup({load:async()=>stored});await tick();assert.deepEqual(restored.store.getSnapshot().bars[barId],row());
  await restored.store.setSaved(barId,false);assert.equal(restored.store.getSnapshot().bars[barId],undefined);
  await restored.store.setSaved(barId,false);assert.equal(restored.requests.length,1);restored.stop();
});

test('failed saves and removals retain the last confirmed state and the exact retry target',async()=>{
  let fail=true;const ui=setup({setSaved:async(_owner,_id,target)=>{if(fail)throw Error('offline');return target?row():null;}});await tick();
  await assert.rejects(ui.store.setSaved(barId,true));assert.equal(ui.store.getSnapshot().bars[barId],undefined);
  assert.deepEqual(ui.store.getSnapshot().operations[barId],{target:true,saving:false,error:true});
  fail=false;await ui.store.setSaved(barId,true);fail=true;await assert.rejects(ui.store.setSaved(barId,false));
  assert.ok(ui.store.getSnapshot().bars[barId]);assert.equal(ui.store.getSnapshot().operations[barId].target,false);
  fail=false;await ui.store.setSaved(barId,false);assert.equal(ui.store.getSnapshot().bars[barId],undefined);ui.stop();
});

test('stale refreshes cannot undo a save or resurrect a removed bar',async()=>{
  let load=async()=>[];const ui=setup({load:()=>load()});await tick();
  const old=deferred();load=()=>old.promise;const refresh=ui.store.refresh();await ui.store.setSaved(barId,true);
  old.resolve([]);await refresh;assert.ok(ui.store.getSnapshot().bars[barId]);
  const stale=deferred();load=()=>stale.promise;const again=ui.store.refresh();await ui.store.setSaved(barId,false);
  stale.resolve([row()]);await again;assert.equal(ui.store.getSnapshot().bars[barId],undefined);ui.stop();
});

test('refresh reconciles a committed save whose response was lost and keeps data on a failed read',async()=>{
  let rows=[],readFail=false;
  const ui=setup({load:async()=>{if(readFail)throw Error('offline');return rows;},setSaved:async()=>{rows=[row()];throw Error('response lost');}});await tick();
  await assert.rejects(ui.store.setSaved(barId,true));await ui.store.refresh();
  assert.ok(ui.store.getSnapshot().bars[barId]);assert.equal(ui.store.getSnapshot().operations[barId],undefined);
  readFail=true;await ui.store.refresh();assert.equal(ui.store.getSnapshot().error,true);assert.ok(ui.store.getSnapshot().bars[barId]);ui.stop();
});

test('loading failures and invalid or mismatched payloads never invent a saved bar',async()=>{
  const failed=setup({load:async()=>{throw Error('offline');}});await tick();assert.equal(failed.store.getSnapshot().status,'error');
  await assert.rejects(failed.store.setSaved(barId,true));failed.stop();
  const ui=setup({setSaved:async()=>row({user_id:otherUserId})});await tick();
  await assert.rejects(ui.store.setSaved('invalid',true));await assert.rejects(ui.store.setSaved(barId,true));
  assert.equal(Object.keys(ui.store.getSnapshot().bars).length,0);ui.stop();
});

test('late results cannot mutate an account after sign-out and a different account has independent state',async()=>{
  const result=deferred();const ui=setup({setSaved:()=>result.promise});await tick();const write=ui.store.setSaved(barId,true);await tick();ui.stop();
  result.resolve(row());await assert.rejects(write,/Account changed/);assert.equal(ui.store.getSnapshot().bars[barId],undefined);
  const next=createSavedBarsStore(otherUserId,null);const stop=next.start();assert.deepEqual(next.getSnapshot().bars,{});stop();
});

test('demo bookmarks remain session-only, are repeatable and never enter a new account or demo session',async()=>{
  const store=createSavedBarsStore(userId,null,()=>at);const stop=store.start();
  await store.setSaved(barId,true);assert.deepEqual(store.getSnapshot().bars[barId],row());
  await store.refresh();assert.ok(store.getSnapshot().bars[barId]);await store.setSaved(barId,false);assert.deepEqual(store.getSnapshot().bars,{});
  await store.setSaved(barId,true);stop();const fresh=createSavedBarsStore(userId,null);assert.deepEqual(fresh.getSnapshot().bars,{});
});
