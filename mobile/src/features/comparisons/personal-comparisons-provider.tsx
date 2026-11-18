import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type PropsWithChildren } from 'react';

import { mockVenues } from '@/fixtures/venues';
import type { Venue } from '@/types/venue';
import { createSessionSubmissionId, SESSION_USER_ID } from '../contributions/contribution-state';
import { selectPersonalRankings } from '../rankings/personal-rankings';
import { createRatingJourneyState, getRatingJourneyView, ratingJourneyReducer, type RatingJourneyAction, type RatingJourneyState } from '../ratings/rating-journey-state';
import type { Sentiment } from '../sentiments/sentiment-state';

import {
  parseUuid,
  type PersonalComparisonState, type UUID,
} from './comparison-state';

const CHOICE_FEEDBACK_MS = 650;
type PersonalComparisonsContextValue = {
  state: PersonalComparisonState;
  venues: readonly Venue[];
  choose: (round: number, winnerId: string) => void;
  skip: (round: number) => void;
  journey: RatingJourneyState;
  dispatchJourney: (action: RatingJourneyAction) => void;
};
const PersonalComparisonsContext = createContext<PersonalComparisonsContextValue | null>(null);

// A dedicated session provider keeps personal preferences independent of all reviews.
export function PersonalComparisonsProvider({ children, venues = mockVenues }: PropsWithChildren<{ venues?: readonly Venue[] }>) {
  const [journey, dispatchJourney] = useReducer(ratingJourneyReducer, venues,
    (catalog) => createRatingJourneyState(SESSION_USER_ID, catalog.map((venue) => venue.id)));
  const state = journey.comparisons;
  useEffect(() => {
    dispatchJourney({ type: 'catalog', venueIds: venues.map((venue) => venue.id) });
  }, [venues]);

  useEffect(() => {
    if (state.phase !== 'feedback') return;
    const timer = setTimeout(() => dispatchJourney({ type: 'legacy', action: { type: 'advance', round: state.round } }), CHOICE_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [state.phase, state.round]);

  const value = useMemo<PersonalComparisonsContextValue>(() => ({
    state, venues, journey, dispatchJourney,
    choose: (round, winnerId) => {
      const winner = parseUuid(winnerId);
      if (!winner || state.phase !== 'ready' || state.round !== round || !state.pair?.includes(winner)) return;
      const loser = state.pair.find((id) => id !== winner);
      const id = parseUuid(createSessionSubmissionId());
      if (!loser || !id) return;
      // Preserve actual submission order even when two choices share a clock tick.
      const lastTime = Date.parse(state.history[state.history.length - 1]?.created_at ?? '') || 0;
      dispatchJourney({ type: 'legacy', action: { type: 'vote', round, comparison: {
        id, user_id: state.userId, winner_bar_id: winner, loser_bar_id: loser,
        created_at: new Date(Math.max(Date.now(), lastTime + 1)).toISOString(),
      } } });
    },
    skip: (round) => dispatchJourney({ type: 'legacy', action: { type: 'skip', round } }),
  }), [state, venues, journey]);

  return <PersonalComparisonsContext.Provider value={value}>{children}</PersonalComparisonsContext.Provider>;
}

// The overlay owns only drafts/animation. Sentiment, progress and the shared
// comparison history all remain in this existing provider above screen routes.
export function useVenueRatingJourney(barId: string) {
  const context = useContext(PersonalComparisonsContext);
  if (!context) throw new Error('useVenueRatingJourney must be used inside PersonalComparisonsProvider.');
  const { journey, dispatchJourney, venues } = context;
  const open = useCallback((overlayId: string) => dispatchJourney({ type: 'open', overlayId, barId }), [dispatchJourney, barId]);
  const close = useCallback((overlayId: string) => dispatchJourney({ type: 'close', overlayId }), [dispatchJourney]);
  const view = getRatingJourneyView(journey, barId);
  const lookup = (id: string) => venues.find((venue) => venue.id.toLowerCase() === id);
  const first = view.prompt ? lookup(view.prompt.pair[0]) : undefined;
  const second = view.prompt ? lookup(view.prompt.pair[1]) : undefined;
  return {
    ...view,
    available: journey.catalogIds.includes(barId.toLowerCase() as UUID),
    pair: first && second ? [first, second] as const : null,
    open, close,
    save: (sentiment: Sentiment, resume = true) => {
      if (!view.token) return;
      dispatchJourney({ ...view.token, type: 'save-sentiment', sentiment, resume, at: new Date().toISOString(), flowId: createSessionSubmissionId() });
    },
    choose: (winnerId: string) => {
      const winner = parseUuid(winnerId);
      const id = parseUuid(createSessionSubmissionId());
      if (!view.token || !view.prompt || !winner || !id || !view.prompt.pair.includes(winner)) return;
      const loser = view.prompt.pair.find((candidate) => candidate !== winner);
      if (!loser) return;
      const lastTime = Date.parse(journey.comparisons.history.at(-1)?.created_at ?? '') || 0;
      dispatchJourney({ ...view.token, type: 'flow', action: { ...view.prompt.token, type: 'vote', comparison: {
        id, user_id: journey.comparisons.userId, winner_bar_id: winner, loser_bar_id: loser,
        created_at: new Date(Math.max(Date.now(), lastTime + 1)).toISOString(),
      } } });
    },
    skip: (remaining = false) => {
      if (!view.token || !view.prompt) return;
      dispatchJourney({ ...view.token, type: 'flow', action: { ...view.prompt.token, type: remaining ? 'skip-remaining' : 'skip-one' } });
    },
  };
}

export function usePersonalComparisons() {
  const context = useContext(PersonalComparisonsContext);
  if (!context) throw new Error('usePersonalComparisons must be used inside PersonalComparisonsProvider.');
  const { state, venues } = context;
  const lookup = (id: UUID) => venues.find((venue) => venue.id.toLowerCase() === id);
  const first = state.pair ? lookup(state.pair[0]) : undefined;
  const second = state.pair ? lookup(state.pair[1]) : undefined;
  // Deliberately omit internal Elo values and raw ranking rows from the UI contract.
  return {
    pair: first && second ? [first, second] as const : null,
    round: state.round,
    phase: state.phase,
    feedback: state.feedback,
    savedCount: state.history.length,
    choose: (venueId: string) => context.choose(state.round, venueId),
    skip: () => context.skip(state.round),
    winnerName: state.feedback?.kind === 'vote' ? lookup(state.feedback.winnerId)?.name ?? null : null,
    onlyOnePair: state.venueIds.length === 2,
  };
}

export function usePersonalRankings() {
  const context = useContext(PersonalComparisonsContext);
  if (!context) throw new Error('usePersonalRankings must be used inside PersonalComparisonsProvider.');
  const { rankings, history } = context.state;
  const { venues } = context;
  // Votes replace these references; Skip preserves them. No refresh or second history.
  return useMemo(() => selectPersonalRankings({ rankings, history }, venues), [rankings, history, venues]);
}
