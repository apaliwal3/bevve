import type { ImageSource } from 'expo-image';

// Venue presentation data contains no overall bar score or community vote baseline.
export type Venue = {
  id: string;
  name: string;
  area: string;
  vibe: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  isPopular: boolean;
  image: number | ImageSource | null;
  crowd: { level: 1 | 2 | 3 | 4 | 5; label: string } | null;
  startingPriceCents: number | null;
  bathroomCleanliness: number | null;
};

export type BathroomCategorySummary = { average: number | null; count: number };

export type VenueDetails = {
  city: string;
  address: string | null;
  openingHoursLabel: string | null;
  crowd: {
    score: number | null;
    reportCount: number;
    newestReportAgeMinutes: number | null;
  };
  drinks: {
    id: string;
    name: string;
    serving: string;
    priceCents: number | null;
    currency: 'EUR';
  }[];
  languages: { code: string; name: string }[];
  bathrooms: {
    reviewCount: number;
    cleanliness: BathroomCategorySummary;
    accessibility: BathroomCategorySummary;
    waitTime: BathroomCategorySummary;
  } | null;
  demoSafetyNotes: string[];
};
