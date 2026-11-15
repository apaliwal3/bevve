import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { mockVenueDetails } from '@/fixtures/venues';
import type { Venue, VenueDetails } from '@/types/venue';

import {
  aggregateBathroomReviews,
  aggregateCrowdReports,
  CROWD_WINDOW_MS,
  contributionsReducer,
  createSessionSubmissionId,
  initialContributionsState,
  latestUserCrowdReport,
  SESSION_USER_ID,
  type BathroomScores,
  type CrowdLevel,
  type VenueContributionsState,
} from '../contributions/contribution-state';

import {
  communityRatingWithUser,
  venueRatingsReducer,
  type StarRating,
  type VenueRatingsState,
} from './rating-state';

type VenueRatingsContextValue = {
  ratings: VenueRatingsState;
  saveRating: (venueId: string, rating: StarRating) => void;
  contributions: VenueContributionsState;
  now: number;
  submitCrowdReport: (venueId: string, level: CrowdLevel) => void;
  saveBathroomReview: (venueId: string, scores: BathroomScores) => void;
};

const VenueRatingsContext = createContext<VenueRatingsContextValue | null>(null);

// One demo user for this app session. No browser/native persistence or backend writes.
export function VenueRatingsProvider({ children }: PropsWithChildren) {
  const [ratings, dispatch] = useReducer(venueRatingsReducer, {});
  // Separate reducers keep overall ratings completely independent from contributions.
  const [contributions, dispatchContribution] = useReducer(contributionsReducer, initialContributionsState);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const interval = setInterval(refresh, 30_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, []);
  useEffect(() => {
    const currentTime = Date.now();
    const expirations = contributions.crowdReports
      .map((report) => Date.parse(report.created_at) + CROWD_WINDOW_MS + 1)
      .filter((expiration) => expiration > currentTime);
    if (expirations.length === 0) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(...expirations) - currentTime);
    return () => clearTimeout(timer);
  }, [contributions.crowdReports, now]);
  const saveRating = useCallback((venueId: string, rating: StarRating) => {
    dispatch({ venueId, rating });
  }, []);
  const submitCrowdReport = useCallback((venueId: string, level: CrowdLevel) => {
    const submittedAt = Date.now();
    setNow(submittedAt);
    dispatchContribution({ type: 'submit-crowd', report: {
      id: createSessionSubmissionId(), bar_id: venueId, user_id: SESSION_USER_ID,
      level, created_at: new Date(submittedAt).toISOString(),
    } });
  }, []);
  const saveBathroomReview = useCallback((venueId: string, scores: BathroomScores) => {
    const submittedAt = Date.now();
    const time = new Date(submittedAt).toISOString();
    setNow(submittedAt);
    dispatchContribution({ type: 'save-bathroom', review: {
      ...scores, id: createSessionSubmissionId(), bar_id: venueId, user_id: SESSION_USER_ID,
      created_at: time, updated_at: time,
    } });
  }, []);
  const value = useMemo(() => ({ ratings, saveRating, contributions, now, submitCrowdReport, saveBathroomReview }),
    [ratings, saveRating, contributions, now, submitCrowdReport, saveBathroomReview]);

  return <VenueRatingsContext.Provider value={value}>{children}</VenueRatingsContext.Provider>;
}

export function useVenueContributions(venueId: string, demoBathrooms?: VenueDetails['bathrooms']) {
  const context = useContext(VenueRatingsContext);
  if (!context) throw new Error('useVenueContributions must be used inside VenueRatingsProvider.');
  const id = venueId.toLowerCase();
  const demo = demoBathrooms === undefined ? mockVenueDetails[id]?.bathrooms ?? null : demoBathrooms;
  const ownCrowdReport = latestUserCrowdReport(context.contributions.crowdReports, id, SESSION_USER_ID);
  const ownBathroomReview = context.contributions.bathroomReviews.find((review) => review.bar_id === id && review.user_id === SESSION_USER_ID) ?? null;

  return {
    now: context.now,
    ownCrowdReport,
    ownBathroomReview,
    crowdSummary: aggregateCrowdReports(context.contributions.crowdReports, id, context.now),
    bathroomSummary: aggregateBathroomReviews(context.contributions.bathroomReviews, id, demo),
    submitCrowdReport: (level: CrowdLevel) => context.submitCrowdReport(id, level),
    saveBathroomReview: (scores: BathroomScores) => context.saveBathroomReview(id, scores),
  };
}

export function useVenueRating(venue: Venue) {
  const context = useContext(VenueRatingsContext);
  if (!context) throw new Error('useVenueRating must be used inside VenueRatingsProvider.');

  const userRating = context.ratings[venue.id.toLowerCase()] ?? null;
  return {
    userRating,
    communityRating: communityRatingWithUser(venue.communityRating, userRating),
    saveRating: (rating: StarRating) => context.saveRating(venue.id, rating),
  };
}
