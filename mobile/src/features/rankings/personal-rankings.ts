import type { Venue } from '../../types/venue.ts';
import { parseUuid, type PersonalComparisonState, type UUID } from '../comparisons/comparison-state.ts';

export type RankedVenue = Pick<Venue, 'name' | 'area' | 'vibe' | 'image'> & { id: UUID };
export type PersonalRankingEntry = {
  position: number;
  venue: RankedVenue;
  comparisonCount: number;
};
export type PersonalRankingsView = { entries: PersonalRankingEntry[]; completedCount: number };

// Comparison state owns replay, precision and tie ordering. This selector joins
// venue presentation data and assigns ordinals; raw scores never enter the UI contract.
export function selectPersonalRankings(
  state: Pick<PersonalComparisonState, 'rankings' | 'history'>,
  venues: readonly Venue[],
): PersonalRankingsView {
  const byId = new Map(venues.flatMap((venue) => {
    const id = parseUuid(venue.id);
    return id ? [[id, venue] as const] : [];
  }));
  const entries: PersonalRankingEntry[] = [];
  for (const ranking of state.rankings) {
    const venue = byId.get(ranking.bar_id);
    if (!venue || ranking.comparisons === 0) continue;
    entries.push({
      position: entries.length + 1,
      venue: { id: ranking.bar_id, name: venue.name, area: venue.area, vibe: venue.vibe, image: venue.image },
      comparisonCount: ranking.comparisons,
    });
  }
  return { entries, completedCount: state.history.length };
}
