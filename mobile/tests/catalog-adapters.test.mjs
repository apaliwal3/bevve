import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeCatalogVenue, decodeSavedImpression } from '../../shared/venue-contracts.ts';
import { catalogVenue, catalogDetails, catalogReadData, catalogOpinion, savedImpressions } from '../src/features/catalog/catalog-adapters.ts';
import { selectProfileContributions } from '../src/features/profile/profile-activity.ts';
import { adaptRpcPriceComparison } from '../src/features/prices/price-comparison.ts';
import { at, userId, otherUserId, barId, venue, impression, drink } from './helpers/catalog-fixtures.mjs';

test('database UUIDs and missing metadata are retained without matching fixture names or inventing distances', () => {
  const row = decodeCatalogVenue(venue());
  const mapped = catalogVenue(row);
  assert.equal(mapped.id, barId);
  assert.equal(mapped.name, 'Database venue');
  assert.equal(mapped.area, 'Neighborhood unavailable');
  assert.equal(mapped.image, null);
  assert.equal(mapped.distanceMeters, null);
  assert.equal(catalogDetails(row).address, 'Database address');
  assert.equal(catalogDetails(row).city, 'City unavailable');
});

test('catalog summaries never add demo baselines and sample impressions stay ineligible for community helpers', () => {
  const row=venue({ bathrooms: { review_count: 2, cleanliness: 4.5, accessibility: null, wait_time: 3, accessibility_count: 0, wait_time_count: 1 } });
  const read=catalogReadData(row, impression());
  assert.equal(read.bathrooms.cleanliness.count, 2);
  assert.equal(read.bathrooms.accessibility.average, null);
  assert.equal(read.ownImpression, 'liked');
  assert.deepEqual(read.community, { status: 'unavailable' });
  assert.equal(savedImpressions({ [barId]: impression() },[row])[userId][barId].source,'demo');
});

test('real community zero, one, and edited opinions use database aggregates', () => {
  const row=venue({ is_demo: false, opinions: { available: true, liked_count: 0, fine_count: 0, disliked_count: 0, total_opinions: 0, liked_percentage: null } });
  assert.deepEqual(catalogOpinion(row),{ status: 'empty',count: 0 });
  row.opinions={ available: true,liked_count: 1,fine_count: 1,disliked_count: 1,total_opinions: 3,liked_percentage: 100/3 };
  assert.deepEqual(catalogOpinion(decodeCatalogVenue(row)),{ status: 'ready',count: 3,percentage: 33 });
});

test('malformed or cross-account responses fail instead of becoming successful empty data', () => {
  assert.throws(() => decodeSavedImpression(impression('liked',{ user_id: otherUserId }),userId));
  assert.throws(() => decodeCatalogVenue(venue({ crowd: { report_count: -1 } })));
  assert.throws(() => decodeCatalogVenue(venue({ opinions: { available: true,liked_count: 1,fine_count: 0,disliked_count: 0,total_opinions: 5,liked_percentage: 20 } })));
});

test('editing a server impression keeps one Profile entry with the current value', () => {
  const current=savedImpressions({ [barId]: impression('fine') },[venue()]);
  const result=selectProfileContributions({ impressions: current,crowdReports: [],bathroomReviews: [],priceObservations: [] },userId,[catalogVenue(venue())],[]);
  assert.equal(result.counts.impressions,1);
  assert.equal(result.impressions[0].impression,'fine');
  assert.equal(result.impressions[0].venue.name,'Database venue');
});

test('a reported zero price is distinct from a missing observation and uses the backend serving UUID', () => {
  const row=venue({ drinks: [{ ...drink,price_cents: 0,currency: 'EUR',observed_at: at }] });
  assert.equal(catalogReadData(decodeCatalogVenue(row)).startingPriceCents,0);
  const request={ p_drink_id: drink.id,p_bar_ids: [barId],p_currency: 'EUR' };
  const result=adaptRpcPriceComparison(request,[{ bar_id: barId,price_cents: 0,currency: 'EUR',observed_at: at }],[drink],[catalogVenue(row)]);
  assert.equal(result.rows[0].priceCents,0);
  assert.equal(result.rows[0].servingMl,330);
  assert.equal(adaptRpcPriceComparison(request,[],[drink],[catalogVenue(row)]).missingVenues.length,1);
});
