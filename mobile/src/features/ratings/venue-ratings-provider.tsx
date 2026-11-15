import { createContext, useCallback, useContext, useMemo, useReducer, type PropsWithChildren } from 'react';

import type { Venue } from '@/types/venue';

import {
  communityRatingWithUser,
  venueRatingsReducer,
  type StarRating,
  type VenueRatingsState,
} from './rating-state';

type VenueRatingsContextValue = {
  ratings: VenueRatingsState;
  saveRating: (venueId: string, rating: StarRating) => void;
};

const VenueRatingsContext = createContext<VenueRatingsContextValue | null>(null);

// One demo user for this app session. No browser/native persistence or backend writes.
export function VenueRatingsProvider({ children }: PropsWithChildren) {
  const [ratings, dispatch] = useReducer(venueRatingsReducer, {});
  const saveRating = useCallback((venueId: string, rating: StarRating) => {
    dispatch({ venueId, rating });
  }, []);
  const value = useMemo(() => ({ ratings, saveRating }), [ratings, saveRating]);

  return <VenueRatingsContext.Provider value={value}>{children}</VenueRatingsContext.Provider>;
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
