import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCatalogStore } from '../src/features/catalog/catalog-store.ts';
import { userId, otherUserId, barId, venue, impression } from './helpers/catalog-fixtures.mjs';

function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const tick = () => new Promise(resolve => setImmediate(resolve));
const data = (impressions = []) => ({ venues: [venue()], drinks: [], impressions });

test('a contribution invalidation during an older catalog read queues a fresh aggregate read', async () => {
  const oldRead=deferred();let loads=0;
  const store=createCatalogStore(userId,{load:async()=>++loads===2?oldRead.promise:{...data(),venues:[venue({crowd:{score:3,report_count:1,newest_report_at:'2026-11-22T18:00:00Z',classification:null}})]},save:async()=>impression()});
  const stop=store.start();await tick();const refresh=store.refresh();store.invalidate();store.invalidate();
  oldRead.resolve(data());await refresh;await tick();assert.equal(loads,3);assert.equal(store.getSnapshot().venues[0].crowd.report_count,1);stop();
});

test('load failures expose an error without demo fallback, and a retry loads database rows', async () => {
  let offline = true;
  const store = createCatalogStore(userId, { load: async () => { if (offline) throw new Error('offline'); return data(); }, save: async () => impression() });
  const stop = store.start();
  await tick();
  assert.equal(store.getSnapshot().status, 'error');
  assert.deepEqual(store.getSnapshot().venues, []);
  offline = false;
  await store.refresh();
  assert.equal(store.getSnapshot().status, 'ready');
  assert.equal(store.getSnapshot().venues[0].name, 'Database venue');
  stop();
});

test('repeated save taps coalesce, and only the confirmed server row updates the impression', async () => {
  const pending = deferred();
  let calls = 0;
  let stored = [];
  const store = createCatalogStore(userId, { load: async () => data(stored), save: async () => { calls++; return pending.promise; } });
  const stop = store.start(); await tick();
  const first = store.save(barId, 'liked');
  assert.equal(store.save(barId, 'liked'), first);
  await assert.rejects(store.save(barId, 'fine'), /in progress/);
  assert.equal(calls, 1);
  assert.equal(store.getSnapshot().impressions[barId], undefined);
  assert.equal(store.getSnapshot().saving[barId], true);
  stored = [impression()]; pending.resolve(stored[0]); await first; await tick();
  assert.equal(store.getSnapshot().impressions[barId].updated_at, stored[0].updated_at);
  assert.equal(store.getSnapshot().saving[barId], false);
  stop();
});

test('failed saves preserve the previous impression and allow retry', async () => {
  let fail = true;
  let current = impression('liked');
  const store = createCatalogStore(userId, { load: async () => data([current]), save: async () => {
    if (fail) throw new Error('offline'); current = impression('fine'); return current;
  } });
  const stop = store.start(); await tick();
  await assert.rejects(store.save(barId, 'fine'), /offline/);
  assert.equal(store.getSnapshot().impressions[barId].impression, 'liked');
  assert.equal(store.getSnapshot().saving[barId], false);
  fail = false; await store.save(barId, 'fine'); await tick();
  assert.equal(store.getSnapshot().impressions[barId].impression, 'fine');
  stop();
});

test('a new store restores persisted impressions instead of relying on session memory', async () => {
  let rows = [];
  const repository = { load: async () => data(rows), save: async (_user, _bar, value) => { const row=impression(value); rows=[row]; return row; } };
  const first = createCatalogStore(userId, repository); const stop = first.start(); await tick();
  await first.save(barId, 'disliked'); await tick(); stop();
  const reloaded = createCatalogStore(userId, repository); const end = reloaded.start(); await tick();
  assert.equal(reloaded.getSnapshot().impressions[barId].impression, 'disliked'); end();
});

test('a refresh that began before a save cannot overwrite the acknowledged impression', async () => {
  const staleRead = deferred();
  let loads = 0;
  let row = impression();
  const store = createCatalogStore(userId, { load: async () => ++loads === 2 ? staleRead.promise : data([row]), save: async () => { row=impression('fine'); return row; } });
  const stop = store.start(); await tick();
  const refresh = store.refresh();
  await store.save(barId, 'fine');
  staleRead.resolve(data([impression('liked')])); await refresh; await tick();
  assert.equal(store.getSnapshot().impressions[barId].impression, 'fine');
  assert.equal(loads, 3, 'a fresh follow-up read also updates community summaries');
  stop();
});

test('failure to refresh after a committed save does not turn the save into an error', async () => {
  let loads = 0;
  const store = createCatalogStore(userId, { load: async () => { if (++loads > 1) throw new Error('offline'); return data(); }, save: async () => impression() });
  const stop = store.start(); await tick();
  await store.save(barId, 'liked'); await tick();
  assert.equal(store.getSnapshot().impressions[barId].impression, 'liked');
  assert.equal(store.getSnapshot().status, 'ready');
  assert.equal(store.getSnapshot().error, true); stop();
});

test('late responses after account changes cannot populate the next account', async () => {
  const pending = deferred();
  const a = createCatalogStore(userId, { load: async () => data(), save: async () => pending.promise });
  const stop = a.start(); await tick();
  const saving = a.save(barId, 'liked'); stop();
  const b = createCatalogStore(otherUserId, { load: async () => data(), save: async () => { throw new Error('unused'); } });
  const end = b.start(); await tick();
  pending.resolve(impression()); await assert.rejects(saving, /Account changed/);
  assert.deepEqual(b.getSnapshot().impressions, {}); end();
});

test('effect cleanup and replay ignore an old load and finish with the new response', async () => {
  const stale = deferred(); let loads=0;
  const store = createCatalogStore(userId, { load: async () => ++loads === 1 ? stale.promise : data(), save: async () => impression() });
  const stop = store.start(); stop(); const end=store.start(); await tick();
  stale.resolve({ venues: [], drinks: [], impressions: [impression()] }); await tick();
  assert.equal(store.getSnapshot().venues.length, 1);
  assert.deepEqual(store.getSnapshot().impressions, {}); end();
});
