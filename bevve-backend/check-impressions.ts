import assert from 'node:assert/strict';
import { createBarHopClient, authService, barsService, impressionsService } from './src/index.ts';
import { decodeSavedImpression, type SavedImpressionRow } from '../shared/venue-contracts.ts';

// Explicit write check, restricted to a sample venue and the configured test user.
// An existing impression is restored; otherwise one sample impression remains.
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const a = createBarHopClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_KEY!, options);
const b = createBarHopClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_KEY!, options);
let original: SavedImpressionRow | null = null;
let barId: string | undefined;
let written = false;
try {
  const login = await authService(a).signIn(process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
  assert.ok(login.user);
  const rows = await barsService(a).getVenueCatalog();
  barId = rows?.find(row => row.venue.is_demo)?.venue.id;
  assert.ok(barId, 'This write check requires an existing sample venue');
  const before = await a.from('venue_impressions').select('*').eq('user_id', login.user.id).eq('bar_id', barId).maybeSingle();
  if (before.error) throw before.error;
  original = before.data ? decodeSavedImpression(before.data, login.user.id) : null;
  const first = await impressionsService(a).saveImpression(barId, 'liked');
  written = true;
  assert.equal(first.impression, 'liked');
  console.log('PASS: authenticated impression upsert');
  await authService(b).signIn(process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
  const restored = await b.from('venue_impressions').select('*').eq('bar_id', barId).single();
  if (restored.error) throw restored.error;
  assert.equal(decodeSavedImpression(restored.data, login.user.id).impression, 'liked');
  console.log('PASS: a new session reloads the saved impression');
  const edited = await impressionsService(b).saveImpression(barId, 'fine');
  assert.equal(edited.impression, 'fine');
  const after = await a.from('venue_impressions').select('*').eq('bar_id', barId);
  if (after.error) throw after.error;
  assert.equal(after.data.length, 1);
  assert.equal(after.data[0].impression, 'fine');
  console.log('PASS: editing keeps exactly one current impression');
} catch (error) {
  console.error('Impression check failed:', error instanceof Error ? error.message : 'Supabase request failed');
  process.exitCode = 1;
} finally {
  try {
    if (original && barId && written) {
      await impressionsService(a).saveImpression(barId, original.impression);
      console.log('Restored the test account’s previous impression.');
    } else if (barId && written) console.log('The test account now has one persisted impression on a sample venue.');
  } finally {
    await Promise.all([a.auth.signOut({ scope: 'local' }), b.auth.signOut({ scope: 'local' })]);
  }
}
