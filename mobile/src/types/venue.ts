import type { ImageSource } from 'expo-image';

// Temporary presentation model; community ratings are separate from bathroom scores and rankings.
export type Venue = {
  id: string;
  name: string;
  area: string;
  vibe: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  isPopular: boolean;
  image: number | ImageSource | null;
  communityRating: { average: number; count: number } | null;
  crowd: { level: 1 | 2 | 3 | 4 | 5; label: string } | null;
  startingPriceCents: number | null;
  bathroomCleanliness: number | null;
};
