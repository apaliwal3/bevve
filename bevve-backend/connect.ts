import assert from 'node:assert/strict';
import {
  createBarHopClient, authService, barsService, crowdService,
  bathroomsService, drinksService, rankingsService, safetyService,
} from './src/index.ts';

function required(name: string) {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Missing ${name} in bevve-backend/.env`);
  return name === 'TEST_PASSWORD' ? value : value.trim();
}

// Reads only; never print credentials or account records. Local sign-out leaves
// the test account's sessions on other devices intact.
async function checkConnection() {
  const url = required('EXPO_PUBLIC_SUPABASE_URL');
  const key = required('EXPO_PUBLIC_SUPABASE_KEY');
  const client = createBarHopClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const anonymous = createBarHopClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = authService(client);
  let checks = 0;
  function pass(label: string) { checks++; console.log(`PASS: ${label}`); }

  try {
    const signedIn = await auth.signIn(required('TEST_EMAIL'), required('TEST_PASSWORD'));
    assert.ok(signedIn.user && signedIn.session, 'Sign-in must return a user and session');
    pass('test-account authentication');
    const profile = await auth.getMyProfile();
    assert.equal(profile.id, signedIn.user.id);
    pass('own profile read');
    const bars = await barsService(client).listBars();
    assert.ok(bars && bars.length > 0, 'No venues found; apply the catalog seed first');
    pass(`venue catalog read (${bars.length} venues on first page)`);
    const drinks = await drinksService(client).listDrinks();
    assert.ok(drinks && drinks.length > 0, 'No drinks found; apply the catalog seed first');
    pass('drink catalog read');
    await barsService(client).getLanguages(bars[0].id);
    pass('venue language read');
    const crowd = await crowdService(client).getBarCrowd(bars[0].id);
    assert.ok(Array.isArray(crowd) && crowd.length === 1, 'Crowd RPC must return one summary');
    pass('crowd summary RPC');
    const bathroom = await bathroomsService(client).getBathroomSummary(bars[0].id);
    assert.ok(Array.isArray(bathroom) && bathroom.length === 1, 'Bathroom RPC must return one summary');
    pass('bathroom summary RPC');
    if (bars.length >= 2) {
      await drinksService(client).compareDrinkPrices(drinks[0].id, bars.slice(0, 20).map(bar => bar.id));
      pass('drink price comparison RPC');
    }
    await rankingsService(client).getMyRankings();
    pass('personal rankings read');
    await safetyService(client).getMyIncidentReports();
    await safetyService(client).getPublishedIncidents(bars[0].id);
    pass('incident read paths');

    for (const table of ['profiles', 'bars', 'drinks', 'bar_languages', 'crowd_reports',
      'bathroom_reviews', 'bar_comparisons', 'incident_reports', 'published_incidents']) {
      const { data, error } = await anonymous.from(table).select('*').limit(1);
      assert.ok(error || data?.length === 0, `Signed-out client unexpectedly read ${table}`);
      pass(`signed-out ${table} access denied or empty`);
    }
    for (const [name, args] of [
      ['get_bar_crowd', { p_bar_id: bars[0].id }],
      ['get_bathroom_summary', { p_bar_id: bars[0].id }],
      ['compare_drink_prices', { p_drink_id: drinks[0].id, p_bar_ids: [bars[0].id], p_currency: 'EUR' }],
    ] as const) {
      const { error } = await anonymous.rpc(name, args);
      assert.equal(error?.code, '42501', `Signed-out ${name} must fail with insufficient privilege`);
      pass(`signed-out ${name} denied`);
    }
    console.log(`\n${checks} read-only checks passed. Ownership, writes, and moderation still need database integration checks.`);
  } finally {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }
}

try {
  await checkConnection();
} catch (error) {
  console.error('Connection check failed:', error instanceof Error ? error.message : 'Supabase request failed');
  process.exitCode = 1;
}
