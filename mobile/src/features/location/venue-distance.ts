import type { CatalogVenueRow } from '../../../../shared/venue-contracts.ts';
import type { Translate } from '../../localization/translation.ts';
import { catalogVenue } from '../catalog/catalog-adapters.ts';

export type Coordinates = { latitude: number; longitude: number };
export const NEARBY_RADIUS_METERS = 1000;
export const validCoordinates = (point: Coordinates) => Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
  Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
export function distanceMeters(from: Coordinates, to: Coordinates): number | null {
  if (!validCoordinates(from) || !validCoordinates(to)) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(to.latitude - from.latitude), dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
export function catalogDistance(row: Pick<CatalogVenueRow, 'latitude' | 'longitude' | 'is_demo'>, location: Coordinates | null) {
  return !location || row.is_demo ? null : distanceMeters(location, row);
}
type Format = { number: (value: number) => string; decimal: (value: number, digits?: number) => string };
export function distanceLabel(meters: number | null, t: Translate, format: Format): string | null {
  if (meters === null || !Number.isFinite(meters) || meters < 0) return null;
  if (meters < 50) return t('Under 50 m away');
  return meters < 1000 ? t('About {distance} m away', { distance: format.number(Math.round(meters / 10) * 10) })
    : t('About {distance} km away', { distance: format.decimal(meters / 1000, 1) });
}
export function locatedCatalogVenue(row: CatalogVenueRow, location: Coordinates | null, t: Translate, format: Format) {
  const meters = catalogDistance(row, location);
  return { ...catalogVenue(row), distanceMeters: meters, distanceLabel: distanceLabel(meters, t, format) };
}

export type AccountVenueFilter = 'All' | 'Nearby' | 'Cheap' | 'Quiet' | 'Popular';
export function selectAccountVenues(venues: readonly CatalogVenueRow[], query: string, filter: AccountVenueFilter, location: Coordinates | null) {
  const search = query.trim().toLowerCase();
  const rows = venues.filter(row => {
    if (!`${row.name} ${row.area ?? ''}`.toLowerCase().includes(search)) return false;
    if (filter === 'Cheap') return row.drinks.some(drink => drink.price_cents <= 500);
    if (filter === 'Quiet') return row.crowd.classification === 'quiet';
    if (filter === 'Popular') return row.is_popular;
    return true;
  });
  if (filter !== 'Nearby') return rows;
  return rows.map(row => ({ row, meters: catalogDistance(row, location) }))
    .filter((item): item is { row: CatalogVenueRow; meters: number } => item.meters !== null && item.meters <= NEARBY_RADIUS_METERS)
    .sort((a, b) => a.meters - b.meters || a.row.name.localeCompare(b.row.name) || a.row.id.localeCompare(b.row.id))
    .map(item => item.row);
}
