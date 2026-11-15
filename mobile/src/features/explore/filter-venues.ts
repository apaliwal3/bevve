import type { Venue } from '../../types/venue';

export const venueFilters = ['All', 'Nearby', 'Cheap', 'Quiet', 'Popular'] as const;
export type VenueFilter = (typeof venueFilters)[number];

// Explicit demo rules; distance is fixture data, not the user's location.
export function filterVenues(venues: readonly Venue[], query: string, filter: VenueFilter): Venue[] {
  const search = query.trim().toLowerCase();
  return venues.filter((venue) => {
    if (!`${venue.name} ${venue.area}`.toLowerCase().includes(search)) return false;

    switch (filter) {
      case 'Nearby':
        return venue.distanceMeters !== null && venue.distanceMeters <= 1000;
      case 'Cheap':
        return venue.startingPriceCents !== null && venue.startingPriceCents <= 500;
      case 'Quiet':
        return venue.crowd !== null && venue.crowd.level <= 2;
      case 'Popular':
        return venue.isPopular;
      default:
        return true;
    }
  });
}
