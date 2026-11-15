import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { mockVenueDetails } from '@/fixtures/venues';
import { mockDrinkCatalog, type VenueLanguageCode } from '@/fixtures/contribution-catalog';
import type { Venue, VenueDetails } from '@/types/venue';
import type { IncidentSubmission } from '../contributions/extra-form-drafts';
import {
  initialVenueExtrasState,
  publicVenueExtras,
  startingPriceCents,
  validPriceCents,
  venueExtrasReducer,
  venuesWithLatestPrices,
  type VenueExtrasState,
} from '../contributions/venue-extras-state';

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
  extras: VenueExtrasState;
  submitDrinkPrice: (venueId: string, drinkId: string, cents: number) => void;
  suggestLanguage: (venueId: string, code: VenueLanguageCode) => void;
  submitIncident: (venueId: string, incident: IncidentSubmission) => void;
};

const VenueRatingsContext = createContext<VenueRatingsContextValue | null>(null);

// One demo user for this app session. No browser/native persistence or backend writes.
export function VenueRatingsProvider({ children }: PropsWithChildren) {
  const [ratings, dispatch] = useReducer(venueRatingsReducer, {});
  // Separate reducers keep overall ratings completely independent from contributions.
  const [contributions, dispatchContribution] = useReducer(contributionsReducer, initialContributionsState);
  const [extras, dispatchExtra] = useReducer(venueExtrasReducer, initialVenueExtrasState);
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
  const submitDrinkPrice = useCallback((venueId: string, drinkId: string, cents: number) => {
    if (!validPriceCents(cents) || !mockDrinkCatalog.some((drink) => drink.id === drinkId)) return;
    dispatchExtra({ type: 'observe-price', observation: {
      id: createSessionSubmissionId(), bar_id: venueId, drink_id: drinkId, price_cents: cents,
      currency: 'EUR', submitted_by: SESSION_USER_ID, observed_at: new Date().toISOString(),
    } });
  }, []);
  const suggestLanguage = useCallback((venueId: string, code: VenueLanguageCode) => {
    dispatchExtra({ type: 'suggest-language', associatedCodes: (mockVenueDetails[venueId]?.languages ?? []).map((language) => language.code), suggestion: {
      id: createSessionSubmissionId(), bar_id: venueId, language_code: code,
      suggested_by: SESSION_USER_ID, status: 'pending', created_at: new Date().toISOString(),
    } });
  }, []);
  const submitIncident = useCallback((venueId: string, incident: IncidentSubmission) => {
    dispatchExtra({ type: 'report-incident', report: {
      ...incident, id: createSessionSubmissionId(), bar_id: venueId, reporter_id: SESSION_USER_ID,
      status: 'pending', created_at: new Date().toISOString(),
    } });
  }, []);
  const value = useMemo(() => ({
    ratings, saveRating, contributions, now, submitCrowdReport, saveBathroomReview,
    extras, submitDrinkPrice, suggestLanguage, submitIncident,
  }), [ratings, saveRating, contributions, now, submitCrowdReport, saveBathroomReview,
    extras, submitDrinkPrice, suggestLanguage, submitIncident]);

  return <VenueRatingsContext.Provider value={value}>{children}</VenueRatingsContext.Provider>;
}

export function useVenueExtras(venueId: string) {
  const context = useContext(VenueRatingsContext);
  if (!context) throw new Error('useVenueExtras must be used inside VenueRatingsProvider.');
  const id = venueId.toLowerCase();
  const publicData = publicVenueExtras(context.extras, id, mockVenueDetails[id]);
  return {
    ...publicData,
    startingPriceCents: startingPriceCents(publicData.drinks),
    submitDrinkPrice: (drinkId: string, cents: number) => context.submitDrinkPrice(id, drinkId, cents),
    suggestLanguage: (code: VenueLanguageCode) => context.suggestLanguage(id, code),
    submitIncident: (incident: IncidentSubmission) => context.submitIncident(id, incident),
  };
}

// Explore filters must use the same latest prices as the cards and Bar Details.
// Keep original overall-rating baselines intact to avoid counting a session vote twice.
export function useVenuePriceCatalog(venues: readonly Venue[]) {
  const context = useContext(VenueRatingsContext);
  if (!context) throw new Error('useVenuePriceCatalog must be used inside VenueRatingsProvider.');
  const observations = context.extras.priceObservations;
  return useMemo(() => venuesWithLatestPrices(venues, observations, mockVenueDetails), [observations, venues]);
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
