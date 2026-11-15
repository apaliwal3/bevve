import type { Venue } from '../../types/venue';

export type StarRating = 1 | 2 | 3 | 4 | 5;
export type VenueRatingsState = Partial<Record<string, StarRating>>;
export type SaveRatingAction = { venueId: string; rating: StarRating };

export function venueRatingsReducer(state: VenueRatingsState, action: SaveRatingAction): VenueRatingsState {
  if (!Number.isInteger(action.rating) || action.rating < 1 || action.rating > 5) {
    throw new Error('Choose a whole-star rating from 1 to 5.');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(action.venueId)) {
    throw new Error('A venue UUID is required.');
  }
  const venueId = action.venueId.toLowerCase();
  if (state[venueId] === action.rating) return state;
  return { ...state, [venueId]: action.rating };
}

// Fixtures represent other users' ratings. Always derive from that fixed baseline,
// so repeated edits replace our one contribution without accumulating rounding errors.
export function communityRatingWithUser(
  baseline: Venue['communityRating'],
  userRating: StarRating | null,
): Venue['communityRating'] {
  if (userRating === null) return baseline;
  const count = baseline?.count ?? 0;
  const total = count > 0 && baseline ? baseline.average * count : 0;
  return { average: (total + userRating) / (count + 1), count: count + 1 };
}
