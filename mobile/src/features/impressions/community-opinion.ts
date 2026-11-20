import { normalizeImpressionUuid, normalizeVenueImpression, type VenueImpression } from './impression-state.ts';

export type CommunityOpinionOptions = {
  // A future trusted adapter may further restrict eligible community records.
  isEligible?: (record: VenueImpression) => boolean;
};

export type CommunityOpinion = {
  likedCount: number;
  fineCount: number;
  dislikedCount: number;
  totalDistinctOpinions: number;
  // Raw, unrounded calculation. Every positive distinct-user count is usable.
  likedPercentage: number | null;
};

// Only explicitly community-sourced, valid, eligible records enter this input's
// aggregate. No star baselines or mock contributor are imported or added.
// Select the latest eligible snapshot per user at this venue. Equal timestamps
// use the later supplied snapshot, matching the state operation's edit ordering.
export function calculateCommunityOpinion(
  records: readonly VenueImpression[],
  barId: string,
  options: CommunityOpinionOptions = {},
): CommunityOpinion {
  const venue = normalizeImpressionUuid(barId);
  if (!venue) throw new Error('A venue UUID is required.');
  const latest = new Map<string, VenueImpression>();
  for (const input of records) {
    const record = normalizeVenueImpression(input);
    if (!record || record.bar_id !== venue || record.source !== 'community' ||
      (options.isEligible && !options.isEligible(record))) continue;
    const previous = latest.get(record.user_id);
    if (!previous || record.updated_at >= previous.updated_at) latest.set(record.user_id, record);
  }
  let likedCount = 0;
  let fineCount = 0;
  let dislikedCount = 0;
  for (const record of latest.values()) {
    if (record.impression === 'liked') likedCount++;
    else if (record.impression === 'fine') fineCount++;
    else dislikedCount++;
  }
  const totalDistinctOpinions = latest.size;
  return {
    likedCount, fineCount, dislikedCount, totalDistinctOpinions,
    likedPercentage: totalDistinctOpinions === 0 ? null : likedCount / totalDistinctOpinions * 100,
  };
}
