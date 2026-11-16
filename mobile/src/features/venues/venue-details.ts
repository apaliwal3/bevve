import type { Venue, VenueDetails } from '../../types/venue';

type VenueLookup =
  | { status: 'invalid' | 'not-found' }
  | { status: 'ready'; venue: Venue };

export function resolveVenueById(id: string | string[] | undefined, venues: readonly Venue[]): VenueLookup {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { status: 'invalid' };
  }
  const venue = venues.find((item) => item.id.toLowerCase() === id.toLowerCase());
  return venue ? { status: 'ready', venue } : { status: 'not-found' };
}

export function hasSufficientCrowdData(crowd: VenueDetails['crowd'] | undefined): boolean {
  if (!crowd || crowd.score === null || crowd.newestReportAgeMinutes === null) return false;
  return Number.isFinite(crowd.score) && crowd.score >= 1 && crowd.score <= 5
    && Number.isInteger(crowd.reportCount) && crowd.reportCount >= 3
    && Number.isFinite(crowd.newestReportAgeMinutes)
    && crowd.newestReportAgeMinutes >= 0 && crowd.newestReportAgeMinutes <= 45;
}
