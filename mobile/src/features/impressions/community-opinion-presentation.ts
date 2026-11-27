import { calculateCommunityOpinion } from './community-opinion.ts';
import type { VenueImpression } from './impression-state.ts';

export type CommunitySentiment = 'liked' | 'fine' | 'disliked' | 'mixed';

export type CommunityOpinionView =
  | { status: 'unavailable' }
  | { status: 'empty'; count: 0 }
  | { status: 'ready'; count: number; sentiment: CommunitySentiment };

export function communitySentiment(liked: number, fine: number, disliked: number): CommunitySentiment {
  if (liked > fine && liked > disliked) return 'liked';
  if (fine > liked && fine > disliked) return 'fine';
  if (disliked > liked && disliked > fine) return 'disliked';
  return 'mixed';
}

// null means no genuine community source is connected, not a measured zero.
// A future trusted adapter can supply real records, including an empty result.
// Demo provenance is excluded by calculateCommunityOpinion in all cases.
export function communityOpinionView(records: readonly VenueImpression[] | null, barId: string): CommunityOpinionView {
  if (records === null) return { status: 'unavailable' };
  const opinion = calculateCommunityOpinion(records, barId);
  return opinion.totalDistinctOpinions === 0 ? { status: 'empty', count: 0 }
    : { status: 'ready', count: opinion.totalDistinctOpinions,
      sentiment: communitySentiment(opinion.likedCount, opinion.fineCount, opinion.dislikedCount) };
}
