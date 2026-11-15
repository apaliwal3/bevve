import { createContext, useContext, useEffect, useMemo, useReducer, type PropsWithChildren } from 'react';

import { mockVenues } from '@/fixtures/venues';
import type { Venue } from '@/types/venue';
import { createSessionSubmissionId, SESSION_USER_ID } from '../contributions/contribution-state';
import { selectPersonalRankings } from '../rankings/personal-rankings';

import {
  createPersonalComparisonState, parseUuid, personalComparisonReducer,
  type PersonalComparisonState, type UUID,
} from './comparison-state';

const CHOICE_FEEDBACK_MS = 650;
type PersonalComparisonsContextValue = {
  state: PersonalComparisonState;
  venues: readonly Venue[];
  choose: (round: number, winnerId: string) => void;
  skip: (round: number) => void;
};
const PersonalComparisonsContext = createContext<PersonalComparisonsContextValue | null>(null);

// A dedicated session provider keeps personal preferences independent of all reviews.
export function PersonalComparisonsProvider({ children, venues = mockVenues }: PropsWithChildren<{ venues?: readonly Venue[] }>) {
  const [state, dispatch] = useReducer(personalComparisonReducer, venues,
    (catalog) => createPersonalComparisonState(SESSION_USER_ID, catalog.map((venue) => venue.id)));

  useEffect(() => {
    if (state.phase !== 'feedback') return;
    const timer = setTimeout(() => dispatch({ type: 'advance', round: state.round }), CHOICE_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [state.phase, state.round]);

  const value = useMemo<PersonalComparisonsContextValue>(() => ({
    state, venues,
    choose: (round, winnerId) => {
      const winner = parseUuid(winnerId);
      if (!winner || state.phase !== 'ready' || state.round !== round || !state.pair?.includes(winner)) return;
      const loser = state.pair.find((id) => id !== winner);
      const id = parseUuid(createSessionSubmissionId());
      if (!loser || !id) return;
      // Preserve actual submission order even when two choices share a clock tick.
      const lastTime = Date.parse(state.history[state.history.length - 1]?.created_at ?? '') || 0;
      dispatch({ type: 'vote', round, comparison: {
        id, user_id: state.userId, winner_bar_id: winner, loser_bar_id: loser,
        created_at: new Date(Math.max(Date.now(), lastTime + 1)).toISOString(),
      } });
    },
    skip: (round) => dispatch({ type: 'skip', round }),
  }), [state, venues]);

  return <PersonalComparisonsContext.Provider value={value}>{children}</PersonalComparisonsContext.Provider>;
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
    winnerName: state.feedback?.kind === 'vote' ? lookup(state.feedback.winnerId)?.name ?? 'Your choice' : null,
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
