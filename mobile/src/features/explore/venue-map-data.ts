import type { CatalogVenueRow } from '../../../../shared/venue-contracts.ts';
import type { Venue } from '../../types/venue.ts';

export type VenueMapPin = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  sample: boolean;
};

// Fictional guest bars use illustrative points in their named neighborhoods.
// These are never used for real distances or navigation directions.
const demoPoints: Record<string, readonly [number, number]> = {
  'b3eaae75-0317-4411-9814-7e7a79f4b001': [45.4506, 9.1735],
  'b3eaae75-0317-4411-9814-7e7a79f4b002': [45.4735, 9.2055],
  'b3eaae75-0317-4411-9814-7e7a79f4b003': [45.4875, 9.1895],
  'b3eaae75-0317-4411-9814-7e7a79f4b004': [45.4725, 9.1855],
};

export function demoMapPins(venues: readonly Venue[]): VenueMapPin[] {
  return venues.flatMap(venue => {
    const point = demoPoints[venue.id];
    return point ? [{ id: venue.id, name: venue.name, latitude: point[0], longitude: point[1], sample: true }] : [];
  });
}

export function catalogMapPins(venues: readonly CatalogVenueRow[]): VenueMapPin[] {
  return venues.filter(venue => Number.isFinite(venue.latitude) && Math.abs(venue.latitude) <= 90 &&
    Number.isFinite(venue.longitude) && Math.abs(venue.longitude) <= 180)
    .map(({ id, name, latitude, longitude, is_demo }) => ({ id, name, latitude, longitude, sample: is_demo }));
}

// Only currently displayed venues can be opened by the embedded map.
export function mapSelection(message: string, pins: readonly VenueMapPin[]): string | null {
  try {
    const value: unknown = JSON.parse(message);
    if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'venue' || !('id' in value)) return null;
    return pins.some(pin => pin.id === value.id) ? value.id as string : null;
  } catch { return null; }
}
