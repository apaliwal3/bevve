import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLocationStore, readLocationFix, LOCATION_MAX_AGE_MS, LOCATION_TIMEOUT_MS, LOCATION_REFRESH_INTERVAL_MS } from '../src/features/location/location-store.ts';
import { distanceMeters, distanceLabel, catalogDistance, locatedCatalogVenue, selectAccountVenues } from '../src/features/location/venue-distance.ts';
import { createTranslator } from '../src/localization/translation.ts';
import { createLocaleFormatters } from '../src/localization/formatting.ts';
import { venue } from './helpers/catalog-fixtures.mjs';

const at = Date.parse('2026-11-23T20:00:00Z'), origin = { latitude: 0, longitude: 0 };
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function clock() {
  let now = at, next = 0; const timers = new Map();
  return { now: () => now, set(callback, delay) { const id = ++next; timers.set(id, { callback, at: now + delay }); return id; },
    clear(id) { timers.delete(id); }, advance(ms) {
      const target = now + ms;
      for (;;) { const entry = [...timers].sort((a, b) => a[1].at - b[1].at)[0]; if (!entry || entry[1].at > target) break;
        timers.delete(entry[0]); now = entry[1].at; entry[1].callback(); }
      now = target;
    }, get size() { return timers.size; } };
}
function setup(overrides = {}, foreground = true) {
  const time = clock(), calls = [], streams = [];
  let permission = { granted: true, canAskAgain: true }, requested = { granted: true, canAskAgain: true }, services = true, removed = 0;
  const repository = { permissions: async () => { calls.push('permissions'); await Promise.resolve(); return permission; },
    requestPermissions: async () => { calls.push('request'); return requested; }, servicesEnabled: async () => { calls.push('services'); return services; },
    watch: async (fix, error) => { calls.push('watch'); streams.push({ fix, error }); return () => { removed++; }; },
    openSettings: async () => { calls.push('settings'); }, ...overrides };
  const store = createLocationStore(repository, time), stop = store.start(foreground);
  const raw = (overrides = {}) => ({ timestamp: time.now(), coords: { ...origin, accuracy: 30 }, ...overrides });
  return { store, stop, calls, streams, time, raw, permission(value) { permission = value; }, requested(value) { requested = value; }, services(value) { services = value; },
    get removed() { return removed; }, async ready() { const promise = store.enable(); await tick(); streams.at(-1).fix(raw()); await promise; } };
}

test('geographic distance handles zero coordinates, known city distances, antipodes and the date line', () => {
  assert.equal(distanceMeters(origin, origin), 0);
  assert.ok(Math.abs(distanceMeters(origin, { latitude: 0, longitude: 1 }) - 111195) < 2);
  const parisLondon = distanceMeters({ latitude: 48.8566, longitude: 2.3522 }, { latitude: 51.5074, longitude: -0.1278 });
  assert.ok(parisLondon > 340000 && parisLondon < 350000);
  const dateLine = distanceMeters({ latitude: 0, longitude: 179.999 }, { latitude: 0, longitude: -179.999 });
  assert.ok(dateLine > 220 && dateLine < 225);
  assert.ok(Number.isFinite(distanceMeters(origin, { latitude: 0, longitude: 180 })));
  for (const bad of [{ latitude: NaN, longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }, { latitude: 0, longitude: -181 }]) assert.equal(distanceMeters(origin, bad), null);
});

test('distance labels show approximate metric units while sample venues and absent device locations remain unavailable', () => {
  const t = createTranslator('en'), format = createLocaleFormatters('en');
  assert.equal(distanceLabel(0, t, format), 'Under 50 m away'); assert.equal(distanceLabel(153, t, format), 'About 150 m away');
  assert.equal(distanceLabel(1510, t, format), 'About 1.5 km away'); assert.equal(distanceLabel(null, t, format), null);
  const row = venue({ is_demo: false, ...origin });
  assert.equal(locatedCatalogVenue(row, origin, t, format).distanceMeters, 0);
  assert.equal(catalogDistance({ ...row, is_demo: true }, origin), null); assert.equal(catalogDistance(row, null), null);
  assert.equal(locatedCatalogVenue({ ...row, latitude: NaN }, origin, t, format).distanceLabel, null);
});

test('Nearby uses unrounded 1 km distances, excludes samples and missing fixes, and sorts closest first without mutating catalog order', () => {
  const row = (id, latitude, name = id) => venue({ id, name, latitude, longitude: 0, is_demo: false });
  const rows = [row('outside', 0.009), row('inside', 0.00899), row('near', 0.001), row('mid', 0.004), row('same-b', 0.004, 'Zulu'), row('same-a', 0.004, 'Alpha'),
    row('invalid', NaN), { ...row('sample', 0), is_demo: true }];
  const ids = rows.map(row => row.id);
  assert.deepEqual(selectAccountVenues(rows, '', 'Nearby', origin).map(row => row.id), ['near', 'same-a', 'mid', 'same-b', 'inside']);
  assert.deepEqual(selectAccountVenues(rows, '', 'Nearby', null), []); assert.deepEqual(rows.map(row => row.id), ids);
  assert.deepEqual(selectAccountVenues(rows, ' ALPHA ', 'Nearby', origin).map(row => row.id), ['same-a']);
});

test('existing account filters and neighborhood search work without location and never borrow a fixture distance', () => {
  const cheap = venue({ id: 'cheap', area: 'Navigli', is_demo: false, drinks: [{ price_cents: 400 }] });
  const quiet = venue({ id: 'quiet', crowd: { classification: 'quiet' } }), popular = venue({ id: 'popular', is_popular: true });
  const rows = [cheap, quiet, popular];
  assert.deepEqual(selectAccountVenues(rows, '', 'Cheap', null), [cheap]); assert.deepEqual(selectAccountVenues(rows, '', 'Quiet', null), [quiet]);
  assert.deepEqual(selectAccountVenues(rows, '', 'Popular', null), [popular]); assert.deepEqual(selectAccountVenues(rows, ' NAVIGLI ', 'All', null), [cheap]);
});

test('location decoding rejects stale, non-finite, invalid and too imprecise readings and projects only needed fields', () => {
  const raw = { timestamp: at, coords: { ...origin, accuracy: 30, altitude: 100, speed: 3 } };
  assert.deepEqual(readLocationFix(raw, at), { ...origin, accuracy: 30, timestamp: at });
  assert.equal(readLocationFix({ ...raw, timestamp: at - LOCATION_MAX_AGE_MS }, at), 'stale');
  assert.equal(readLocationFix({ ...raw, timestamp: Infinity }, at), 'stale');
  assert.equal(readLocationFix({ ...raw, timestamp: at + 60000 }, at), 'stale');
  for (const accuracy of [null, -1, 501, NaN, Infinity]) assert.equal(readLocationFix({ ...raw, coords: { ...origin, accuracy } }, at), 'accuracy');
  assert.equal(readLocationFix({ ...raw, coords: { latitude: 99, longitude: 0, accuracy: 30 } }, at), 'unavailable');
});

test('an active account starts location automatically before any filter or enable action', async () => {
  const ui = setup(); await tick(); assert.deepEqual(ui.calls, ['permissions','services','watch']);
  assert.equal(ui.store.getSnapshot().status, 'locating');assert.equal(ui.store.getSnapshot().enabled, true);
  ui.streams[0].fix(ui.raw());assert.equal(ui.store.getSnapshot().status,'ready');ui.stop();
});

test('automatic startup requests missing permission and coalesces retries until the first acceptable fix', async () => {
  const ui = setup(); ui.permission({ granted: false, canAskAgain: true });
  const first = ui.store.enable(), second = ui.store.enable(); assert.equal(first, second);
  await tick(); assert.deepEqual(ui.calls, ['permissions', 'request', 'services', 'watch']); assert.equal(ui.store.getSnapshot().status, 'locating');
  ui.streams[0].fix(ui.raw()); await first; assert.equal(ui.store.getSnapshot().status, 'ready');
  assert.equal(ui.store.getSnapshot().fix.latitude, 0); assert.equal(ui.time.size, 2); ui.stop(); assert.equal(ui.time.size, 0); assert.equal(ui.removed, 1);
});

test('denied permission can be retried explicitly; permanently blocked permission never starts another native prompt', async () => {
  const ui = setup(); ui.permission({ granted: false, canAskAgain: true }); ui.requested({ granted: false, canAskAgain: false });
  await ui.store.enable(); assert.equal(ui.store.getSnapshot().status, 'denied'); assert.equal(ui.store.getSnapshot().canAskAgain, false);
  assert.ok(!ui.calls.includes('watch')); ui.permission({ granted: false, canAskAgain: false });
  await ui.store.enable(); assert.equal(ui.calls.filter(value => value === 'request').length, 1);
  await ui.store.openSettings(); assert.ok(ui.calls.includes('settings')); ui.stop();
});

test('disabled device services have a recoverable state and never start GPS', async () => {
  const ui = setup(); ui.services(false); await ui.store.enable(); assert.equal(ui.store.getSnapshot().status, 'services-off');
  assert.ok(!ui.calls.includes('watch')); ui.services(true); const retry = ui.store.enable(); await tick(); ui.streams[0].fix(ui.raw()); await retry;
  assert.equal(ui.store.getSnapshot().status, 'ready'); ui.stop();
});

test('a missing first fix times out, removes the subscription and ignores late callbacks', async () => {
  const ui = setup(); const first = ui.store.enable(); await tick(); ui.time.advance(LOCATION_TIMEOUT_MS); await first;
  assert.equal(ui.store.getSnapshot().issue, 'timeout'); assert.equal(ui.store.getSnapshot().fix, null); assert.equal(ui.removed, 1);
  ui.streams[0].fix(ui.raw()); assert.equal(ui.store.getSnapshot().status, 'unavailable'); ui.stop();
});

test('coarse readings are rejected without producing invented Nearby results, and an explicit retry can obtain a better fix', async () => {
  const ui = setup(); const first = ui.store.enable(); await tick();
  ui.streams[0].fix(ui.raw({ coords: { ...origin, accuracy: 3000 } })); ui.time.advance(LOCATION_TIMEOUT_MS); await first;
  assert.equal(ui.store.getSnapshot().issue, 'accuracy'); assert.equal(ui.store.getSnapshot().fix, null);
  const retry = ui.store.enable(); await tick(); ui.streams[1].fix(ui.raw()); await retry; assert.equal(ui.store.getSnapshot().status, 'ready'); ui.stop();
});

test('stale native first readings never masquerade as current location', async () => {
  const ui = setup(); const first = ui.store.enable(); await tick(); ui.streams[0].fix(ui.raw({ timestamp: at - 600000 }));
  ui.time.advance(LOCATION_TIMEOUT_MS); await first; assert.equal(ui.store.getSnapshot().issue, 'stale'); assert.equal(ui.store.getSnapshot().fix, null); ui.stop();
});

test('automatic location polls every two minutes and keeps the previous distances ready until a new fix arrives',async()=>{
  const ui=setup();await ui.ready();const first=ui.store.getSnapshot().fix;
  assert.equal(ui.removed,1); // Each poll stops its native subscription after the first acceptable fix.
  ui.time.advance(LOCATION_REFRESH_INTERVAL_MS-1);await tick();assert.equal(ui.streams.length,1);
  ui.time.advance(1);await tick();assert.equal(ui.streams.length,2);
  assert.equal(ui.store.getSnapshot().status,'ready');assert.equal(ui.store.getSnapshot().fix,first);
  ui.streams[0].fix(ui.raw({coords:{latitude:9,longitude:0,accuracy:20}}));assert.equal(ui.store.getSnapshot().fix,first);
  ui.streams[1].fix(ui.raw({coords:{latitude:1,longitude:0,accuracy:20}}));assert.equal(ui.store.getSnapshot().fix.latitude,1);
  ui.streams[1].fix(ui.raw({coords:{latitude:2,longitude:0,accuracy:20}}));assert.equal(ui.store.getSnapshot().fix.latitude,1);
  ui.time.advance(LOCATION_REFRESH_INTERVAL_MS);await tick();assert.equal(ui.streams.length,3);ui.stop();assert.equal(ui.time.size,0);
});

test('a failed silent poll keeps a fresh previous fix and the next poll retries without a new permission prompt',async()=>{
  const ui=setup();await ui.ready();const first=ui.store.getSnapshot().fix;
  ui.time.advance(LOCATION_REFRESH_INTERVAL_MS);await tick();ui.streams[1].error();
  assert.equal(ui.store.getSnapshot().status,'ready');assert.equal(ui.store.getSnapshot().fix,first);
  ui.time.advance(LOCATION_REFRESH_INTERVAL_MS);await tick();assert.equal(ui.streams.length,3);
  ui.streams[2].fix(ui.raw({coords:{latitude:1,longitude:0,accuracy:20}}));
  assert.equal(ui.store.getSnapshot().fix.latitude,1);assert.equal(ui.calls.filter(value=>value==='request').length,0);ui.stop();
});

test('coordinates still expire when repeated silent polls cannot obtain a valid replacement',async()=>{
  const ui=setup();await ui.ready();
  for(let i=0;i<4;i++){ui.time.advance(LOCATION_REFRESH_INTERVAL_MS);await tick();ui.streams.at(-1).error();}
  assert.equal(ui.store.getSnapshot().fix,null);assert.equal(ui.store.getSnapshot().status,'unavailable');ui.stop();
});

test('backgrounding removes GPS and coordinates; foreground refresh rechecks permission without prompting', async () => {
  const ui = setup(); await ui.ready(); ui.store.suspend(); assert.equal(ui.removed, 1); assert.equal(ui.store.getSnapshot().fix, null);
  ui.permission({ granted: false, canAskAgain: true }); ui.store.resume(); await tick();
  assert.equal(ui.store.getSnapshot().status, 'denied'); assert.equal(ui.calls.filter(value => value === 'request').length, 0);
  const before = ui.calls.length; ui.store.resume(); await tick(); assert.equal(ui.calls.length, before); ui.stop();
});

test('a session opened in the background waits for active state before requesting location permission', async () => {
  const ui = setup({}, false);ui.permission({granted:false,canAskAgain:true});
  await ui.store.enable();assert.deepEqual(ui.calls,[]);assert.equal(ui.store.getSnapshot().status,'paused');
  ui.store.resume();await tick();assert.deepEqual(ui.calls,['permissions','request','services','watch']);
  ui.streams[0].fix(ui.raw());assert.equal(ui.store.getSnapshot().status,'ready');ui.stop();
});

test('location stays enabled for the session and automatically restarts after backgrounding', async () => {
  const ui=setup();await ui.ready();ui.store.suspend();assert.equal(ui.removed,1);
  assert.equal(ui.store.getSnapshot().enabled,true);ui.store.resume();await tick();
  assert.equal(ui.calls.filter(value=>value==='watch').length,2);ui.streams[1].fix(ui.raw());
  assert.equal(ui.store.getSnapshot().status,'ready');ui.stop();
});

test('late permissions and watcher registration after cancellation cannot repopulate an account', async () => {
  const permission = deferred(); const ui = setup({ permissions: () => permission.promise }); const enable = ui.store.enable(); ui.stop();
  permission.resolve({ granted: true, canAskAgain: true }); await enable; await tick(); assert.equal(ui.streams.length, 0); ui.stop();
  const registration = deferred(); let callback, removed = 0;
  const late = setup({ watch: async fix => { callback = fix; return registration.promise; } }); const first = late.store.enable(); await tick(); late.stop();
  callback(late.raw()); registration.resolve(() => { removed++; }); await first; await tick(); assert.equal(removed, 1); assert.equal(late.store.getSnapshot().fix, null);
});

test('effect replay and account changes automatically start fresh location without reusing old coordinates', async () => {
  const ui = setup(); await ui.ready(); ui.stop(); const end = ui.store.start(); await tick();
  ui.streams[0].fix(ui.raw({ coords: { latitude: 2, longitude: 2, accuracy: 30 } })); assert.equal(ui.store.getSnapshot().fix, null);
  ui.streams[1].fix(ui.raw()); assert.equal(ui.store.getSnapshot().status, 'ready'); assert.equal(ui.removed, 2); end();
  const other = setup(); await tick(); assert.equal(other.store.getSnapshot().enabled, true); assert.equal(other.store.getSnapshot().fix, null); assert.deepEqual(other.calls, ['permissions','services','watch']); other.stop();
});

test('native errors and settings failures expose recoverable states without raw device messages or unhandled promises', async () => {
  const ui = setup({ openSettings: async () => { throw Error('Native private details'); } }); const first = ui.store.enable(); await tick(); ui.streams[0].error(); await first;
  assert.equal(ui.store.getSnapshot().issue, 'unavailable'); await ui.store.openSettings(); assert.equal(ui.store.getSnapshot().settingsError, true); ui.stop();
  const failed = setup({ permissions: async () => { throw Error('Native private details'); } }); await failed.store.enable();
  assert.equal(failed.store.getSnapshot().status, 'unavailable'); assert.ok(!JSON.stringify(failed.store.getSnapshot()).includes('Native private')); failed.stop();
});


test('a permission prompt survives effect replay without duplicate requests or losing its result',async()=>{
  const prompt=deferred();const ui=setup({requestPermissions:()=>{ui.calls.push('request');return prompt.promise;}});
  ui.permission({granted:false,canAskAgain:true});await tick();assert.equal(ui.calls.filter(value=>value==='request').length,1);
  ui.stop();const stop=ui.store.start();await tick();
  assert.equal(ui.calls.filter(value=>value==='request').length,1);
  prompt.resolve({granted:true,canAskAgain:true});await tick();assert.equal(ui.streams.length,1);
  ui.streams[0].fix(ui.raw());assert.equal(ui.store.getSnapshot().status,'ready');stop();
});

test('a denied automatic request is not shown again on each foreground transition',async()=>{
  const ui=setup();ui.permission({granted:false,canAskAgain:true});ui.requested({granted:false,canAskAgain:true});await tick();
  assert.equal(ui.store.getSnapshot().status,'denied');ui.store.suspend();ui.store.resume();await tick();
  assert.equal(ui.calls.filter(value=>value==='request').length,1);ui.stop();
});


test('periodic polling stops in the background and after unmount and resumes on a fresh two-minute schedule',async()=>{
  const ui=setup();await ui.ready();ui.store.suspend();const calls=ui.calls.length;
  ui.time.advance(LOCATION_REFRESH_INTERVAL_MS*3);await tick();assert.equal(ui.calls.length,calls);assert.equal(ui.time.size,0);
  ui.store.resume();await tick();assert.equal(ui.streams.length,2);ui.streams[1].fix(ui.raw());
  ui.time.advance(LOCATION_REFRESH_INTERVAL_MS-1);await tick();assert.equal(ui.streams.length,2);
  ui.time.advance(1);await tick();assert.equal(ui.streams.length,3);ui.stop();
  const afterStop=ui.calls.length;ui.time.advance(LOCATION_REFRESH_INTERVAL_MS*3);await tick();assert.equal(ui.calls.length,afterStop);
});


test('a repeated cached reading cannot finish a scheduled refresh, and expiry recovers automatically without asking permission again',async()=>{
  const ui=setup();await ui.ready();const first=ui.store.getSnapshot().fix;
  ui.time.advance(LOCATION_REFRESH_INTERVAL_MS);await tick();
  ui.streams[1].fix({timestamp:first.timestamp,coords:{latitude:first.latitude,longitude:first.longitude,accuracy:first.accuracy}});
  assert.equal(ui.removed,1);assert.equal(ui.store.getSnapshot().fix,first);
  ui.time.advance(LOCATION_TIMEOUT_MS);await tick();assert.equal(ui.store.getSnapshot().fix,null);
  ui.time.advance(LOCATION_REFRESH_INTERVAL_MS-LOCATION_TIMEOUT_MS);await tick();assert.equal(ui.streams.length,3);
  ui.streams[2].fix(ui.raw());assert.equal(ui.store.getSnapshot().status,'ready');
  assert.equal(ui.calls.filter(value=>value==='request').length,0);ui.stop();
});
