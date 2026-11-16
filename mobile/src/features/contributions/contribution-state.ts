import type { VenueDetails } from '../../types/venue';
import type { StarRating } from '../ratings/rating-state';

export type CrowdLevel = StarRating;
export const SESSION_USER_ID = '97c0c196-e3f2-4d15-9c53-81757f652dd1';
export const CROWD_WINDOW_MS = 45 * 60 * 1000;

export type SessionCrowdReport = {
  id: string;
  bar_id: string;
  user_id: string;
  level: CrowdLevel;
  created_at: string;
};

export type BathroomScores = {
  cleanliness: StarRating;
  accessibility: StarRating;
  wait_time: StarRating;
};

export type SessionBathroomReview = BathroomScores & {
  id: string;
  bar_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type VenueContributionsState = {
  crowdReports: readonly SessionCrowdReport[];
  bathroomReviews: readonly SessionBathroomReview[];
};

export type ContributionAction =
  | { type: 'submit-crowd'; report: SessionCrowdReport }
  | { type: 'save-bathroom'; review: SessionBathroomReview };

export const initialContributionsState: VenueContributionsState = { crowdReports: [], bathroomReviews: [] };

function uuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('A UUID is required.');
  }
  return value.toLowerCase();
}

function timestamp(value: string): string {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error('A valid report timestamp is required.');
  return new Date(milliseconds).toISOString();
}

function assertScore(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error('Choose a rating from 1 to 5.');
}

export function contributionsReducer(state: VenueContributionsState, action: ContributionAction): VenueContributionsState {
  if (action.type === 'submit-crowd') {
    const input = action.report;
    assertScore(input.level);
    const report: SessionCrowdReport = {
      ...input,
      id: uuid(input.id), bar_id: uuid(input.bar_id), user_id: uuid(input.user_id),
      created_at: timestamp(input.created_at),
    };
    if (state.crowdReports.some((item) => item.id === report.id)) return state;
    return { ...state, crowdReports: [...state.crowdReports, report] };
  }

  const input = action.review;
  assertScore(input.cleanliness);
  assertScore(input.accessibility);
  assertScore(input.wait_time);
  const review: SessionBathroomReview = {
    ...input,
    id: uuid(input.id), bar_id: uuid(input.bar_id), user_id: uuid(input.user_id),
    created_at: timestamp(input.created_at), updated_at: timestamp(input.updated_at),
  };
  if (Date.parse(review.updated_at) < Date.parse(review.created_at)) throw new Error('Invalid review timestamps.');
  const previous = state.bathroomReviews.find((item) => item.bar_id === review.bar_id && item.user_id === review.user_id);
  if (!previous) return { ...state, bathroomReviews: [...state.bathroomReviews, review] };

  return {
    ...state,
    bathroomReviews: state.bathroomReviews.map((item) => item === previous
      ? { ...review, id: previous.id, created_at: previous.created_at }
      : item),
  };
}

export type CrowdSummary = {
  score: number | null;
  report_count: number;
  newest_report_at: string | null;
  classification: 'quiet' | 'moderate' | 'busy' | null;
};

export const crowdClassificationLabels = { quiet: 'Quiet', moderate: 'Moderate', busy: 'Busy' } as const;

function isNewer(candidate: SessionCrowdReport, previous: SessionCrowdReport): boolean {
  const difference = Date.parse(candidate.created_at) - Date.parse(previous.created_at);
  return difference > 0 || (difference === 0 && candidate.id > previous.id);
}

export function latestUserCrowdReport(reports: readonly SessionCrowdReport[], barId: string, userId: string): SessionCrowdReport | null {
  return reports.reduce<SessionCrowdReport | null>((latest, report) => {
    if (report.bar_id !== barId.toLowerCase() || report.user_id !== userId.toLowerCase()) return latest;
    return !latest || isNewer(report, latest) ? report : latest;
  }, null);
}

// Mirrors get_bar_crowd: inclusive 45-minute window, no future reports, latest per
// contributor with an ID tie-break. Fictional fixture snapshots never enter this input.
export function aggregateCrowdReports(reports: readonly SessionCrowdReport[], barId: string, now: number): CrowdSummary {
  const latest = new Map<string, SessionCrowdReport>();
  for (const report of reports) {
    const observed = Date.parse(report.created_at);
    if (report.bar_id !== barId.toLowerCase() || !(observed >= now - CROWD_WINDOW_MS && observed <= now)) continue;
    const previous = latest.get(report.user_id);
    if (!previous || isNewer(report, previous)) latest.set(report.user_id, report);
  }
  const rows = [...latest.values()];
  const count = rows.length;
  const score = count ? rows.reduce((sum, report) => sum + report.level, 0) / count : null;
  return {
    score,
    report_count: count,
    newest_report_at: count ? new Date(Math.max(...rows.map((row) => Date.parse(row.created_at)))).toISOString() : null,
    classification: count < 3 || score === null ? null : score < 2 ? 'quiet' : score < 3.5 ? 'moderate' : 'busy',
  };
}

type BathroomSummary = NonNullable<VenueDetails['bathrooms']>;

// Demo totals remain an immutable baseline representing other fictional reviewers.
// The separate session review array contains at most one row per user/venue.
export function aggregateBathroomReviews(
  reviews: readonly SessionBathroomReview[],
  barId: string,
  demo: VenueDetails['bathrooms'] = null,
): VenueDetails['bathrooms'] {
  const rows = reviews.filter((review) => review.bar_id === barId.toLowerCase());
  if (!demo && rows.length === 0) return null;
  function category(key: keyof BathroomScores, baseline: BathroomSummary['cleanliness'] | undefined) {
    const baselineCount = baseline && baseline.average !== null ? baseline.count : 0;
    const total = (baseline?.average ?? 0) * baselineCount + rows.reduce((sum, review) => sum + review[key], 0);
    const count = baselineCount + rows.length;
    return { average: count ? total / count : null, count };
  }
  return {
    reviewCount: (demo?.reviewCount ?? 0) + rows.length,
    cleanliness: category('cleanliness', demo?.cleanliness),
    accessibility: category('accessibility', demo?.accessibility),
    waitTime: category('wait_time', demo?.waitTime),
  };
}

// Non-security identifiers for ephemeral mock submissions; server IDs will replace these later.
export function createSessionSubmissionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 3) | 8).toString(16);
  });
}
