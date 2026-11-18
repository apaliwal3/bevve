import { normalizeSentimentUuid, normalizeVenueSentiment, type VenueSentiment } from './sentiment-state.ts';

export type CommunityOpinionOptions = {
  // No product minimum has been approved. Absence/null means unresolved.
  minimumOpinions?: number | null;
  // A future trusted adapter may further restrict eligible community records.
  isEligible?: (record: VenueSentiment) => boolean;
};

export type CommunityOpinion = {
  likedCount: number;
  fineCount: number;
  dislikedCount: number;
  totalDistinctOpinions: number;
  // Raw, unrounded calculation; future presentation must honor sufficiency.
  likedPercentage: number | null;
  sufficiency: 'unresolved' | 'insufficient' | 'sufficient';
};

// Only explicitly community-sourced, valid, eligible records enter this input's
// aggregate. No star baselines or mock contributor are imported or added.
// Select the latest eligible snapshot per user at this venue. Equal timestamps
// use the later supplied snapshot, matching the state operation's edit ordering.
export function calculateCommunityOpinion(
  records: readonly VenueSentiment[],
  barId: string,
  options: CommunityOpinionOptions = {},
): CommunityOpinion {
  const venue = normalizeSentimentUuid(barId);
  if (!venue) throw new Error('A venue UUID is required.');
  const minimum = options.minimumOpinions ?? null;
  if (minimum !== null && (!Number.isSafeInteger(minimum) || minimum < 1)) {
    throw new Error('The configured opinion minimum must be a positive integer.');
  }
  const latest = new Map<string, VenueSentiment>();
  for (const input of records) {
    const record = normalizeVenueSentiment(input);
    if (!record || record.bar_id !== venue || record.source !== 'community' ||
      (options.isEligible && !options.isEligible(record))) continue;
    const previous = latest.get(record.user_id);
    if (!previous || record.updated_at >= previous.updated_at) latest.set(record.user_id, record);
  }
  let likedCount = 0;
  let fineCount = 0;
  let dislikedCount = 0;
  for (const record of latest.values()) {
    if (record.sentiment === 'liked') likedCount++;
    else if (record.sentiment === 'fine') fineCount++;
    else dislikedCount++;
  }
  const totalDistinctOpinions = latest.size;
  return {
    likedCount, fineCount, dislikedCount, totalDistinctOpinions,
    likedPercentage: totalDistinctOpinions === 0 ? null : likedCount / totalDistinctOpinions * 100,
    sufficiency: minimum === null ? 'unresolved' : totalDistinctOpinions >= minimum ? 'sufficient' : 'insufficient',
  };
}
