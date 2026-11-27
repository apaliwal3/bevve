import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContributionBatch } from '../src/features/contributions/contribution-batch-store.ts';

test('a final save validates every started section before making any writes',async()=>{
  const batch=createContributionBatch();let writes=0;
  batch.register('crowd',{fingerprint:'3',dirty:true,valid:true,save:()=>{writes++;}});
  batch.register('bathrooms',{fingerprint:'4,null,5',dirty:true,valid:false,save:()=>{writes++;}});
  assert.equal(await batch.submit(),false);assert.equal(writes,0);assert.equal(batch.getSnapshot().invalid,true);
  batch.register('bathrooms',{fingerprint:'4,3,5',dirty:true,valid:true,save:()=>{writes++;}});
  assert.equal(await batch.submit(),true);assert.equal(writes,2);
});

test('retries keep confirmed append-only writes out of the batch and prevent rapid-tap duplicates',async()=>{
  const batch=createContributionBatch();let crowds=0,prices=0,fail=true,resolve;
  batch.register('crowd',{fingerprint:'3',dirty:true,valid:true,save:async()=>{crowds++;await new Promise(done=>{resolve=done;});}});
  batch.register('price',{fingerprint:'650',dirty:true,valid:true,save:async()=>{prices++;if(fail)throw Error('offline');}});
  const first=batch.submit();assert.equal(batch.submit(),first);assert.equal(crowds,1);
  resolve();assert.equal(await first,false);assert.equal(batch.getSnapshot().error,true);assert.equal(batch.getSnapshot().pending,1);
  fail=false;assert.equal(await batch.submit(),true);assert.equal(crowds,1);assert.equal(prices,2);
  assert.equal(await batch.submit(),true);assert.equal(prices,2);
});

test('untouched sections are skipped, and editing a confirmed section saves its new draft',async()=>{
  const batch=createContributionBatch();let writes=0;
  batch.register('crowd',{fingerprint:'3',dirty:false,valid:true,save:()=>{writes++;}});
  assert.equal(await batch.submit(),true);assert.equal(writes,0);
  batch.register('crowd',{fingerprint:'4',dirty:true,valid:true,save:()=>{writes++;}});
  await batch.submit();assert.equal(writes,1);
  batch.register('crowd',{fingerprint:'5',dirty:true,valid:true,save:()=>{writes++;}});
  await batch.submit();assert.equal(writes,2);
});
