import { calculateCommunityOpinion } from './community-opinion.ts';
import type { VenueImpression } from './impression-state.ts';

export type CommunityOpinionView =
  | { status: 'unavailable' }
  | { status: 'empty'; count: 0 }
  | { status: 'ready'; count: number; percentage: number };

// null means no genuine community source is connected, not a measured zero.
// A future trusted adapter can supply real records, including an empty result.
// Demo provenance is excluded by calculateCommunityOpinion in all cases.
export function communityOpinionView(records: readonly VenueImpression[] | null, barId: string): CommunityOpinionView {
  if (records === null) return { status: 'unavailable' };
  const opinion = calculateCommunityOpinion(records, barId);
  return opinion.likedPercentage === null ? { status: 'empty', count: 0 }
    : { status: 'ready', count: opinion.totalDistinctOpinions, percentage: Math.round(opinion.likedPercentage) };
}
