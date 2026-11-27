import assert from 'node:assert/strict';
import { test } from 'node:test';
import { savedBarsRepository } from '../src/features/saved-bars/saved-bars-repository.ts';
import { userId,otherUserId,barId,at } from './helpers/catalog-fixtures.mjs';
const row={user_id:userId,bar_id:barId,created_at:at};
function client({pages=[[row]],insert={data:row,error:null},lookup={data:row,error:null},owner=userId,deleteError=null}={}){
  const calls=[];let page=0;
  const auth={getUser:async()=>({data:{user:{id:owner}},error:null})};
  return{calls,auth,from(table){assert.equal(table,'saved_bars');let mode='read';
    const chain={
      select(columns){calls.push(['select',columns]);return chain;},eq(key,value){calls.push(['eq',key,value]);return chain;},
      order(key,options){calls.push(['order',key,options]);return chain;},
      range(start,end){calls.push(['range',start,end]);return Promise.resolve({data:pages[page++]??[],error:null});},
      insert(input){mode='insert';calls.push(['insert',input]);return chain;},
      delete(){mode='delete';calls.push(['delete']);return chain;},
      single(){return Promise.resolve(mode==='insert'?insert:lookup);},
      then(resolve,reject){return Promise.resolve({data:null,error:deleteError}).then(resolve,reject);},
    };return chain;
  }};
}

test('saved-bar reads page through owner-filtered rows in stable order',async()=>{
  const db=client({pages:[Array.from({length:500},()=>row),[row]]});const rows=await savedBarsRepository(db).load(userId);
  assert.equal(rows.length,501);assert.equal(db.calls.filter(call=>call[0]==='eq'&&call[1]==='user_id'&&call[2]===userId).length,2);
  assert.deepEqual(db.calls.filter(call=>call[0]==='range'),[['range',0,499],['range',500,999]]);
});

test('save retries read an existing row after a uniqueness conflict and preserve its original server date',async()=>{
  const db=client({insert:{data:null,error:{code:'23505'}},lookup:{data:row,error:null}});
  assert.deepEqual(await savedBarsRepository(db).setSaved(userId,barId,true),row);
  assert.deepEqual(db.calls.find(call=>call[0]==='insert'),['insert',{user_id:userId,bar_id:barId}]);
  assert.ok(db.calls.some(call=>call[0]==='eq'&&call[1]==='user_id'&&call[2]===userId));
  assert.ok(db.calls.some(call=>call[0]==='eq'&&call[1]==='bar_id'&&call[2]===barId));
});

test('unsave is scoped to both owner and bar and failures are exposed for retry',async()=>{
  const db=client();assert.equal(await savedBarsRepository(db).setSaved(userId,barId,false),null);
  assert.deepEqual(db.calls,[['delete'],['eq','user_id',userId],['eq','bar_id',barId]]);
  await assert.rejects(savedBarsRepository(client({deleteError:Error('offline')})).setSaved(userId,barId,false),/offline/);
});

test('account changes prevent writes and foreign-owner responses never enter account state',async()=>{
  const db=client({owner:otherUserId});await assert.rejects(savedBarsRepository(db).setSaved(userId,barId,true),/Account changed/);assert.deepEqual(db.calls,[]);
  await assert.rejects(savedBarsRepository(client({insert:{data:{...row,user_id:otherUserId},error:null}})).setSaved(userId,barId,true),/Invalid/);
  await assert.rejects(savedBarsRepository(client({insert:{data:null,error:{code:'offline'}}})).setSaved(userId,barId,true));
});
