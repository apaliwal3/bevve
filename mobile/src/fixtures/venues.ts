import type { Venue, VenueDetails } from '@/types/venue';

// Figma-inspired demo data only. Not connected to the backend seed or any live venue.
export const mockVenues: Venue[] = [
  {
    id: 'b3eaae75-0317-4411-9814-7e7a79f4b001',
    name: 'Luna Rossa',
    area: 'Navigli',
    vibe: 'Loud & social',
    distanceLabel: '8 min walk',
    distanceMeters: 600,
    isPopular: true,
    image: {
      uri: 'https://images.unsplash.com/photo-1546847596-b6c8086514d0?auto=format&fit=crop&w=900&q=85',
    },
    communityRating: { average: 4.7, count: 86 },
    crowd: { level: 4, label: 'Buzzing' },
    startingPriceCents: 500,
    bathroomCleanliness: 4.7,
  },
  {
    id: 'b3eaae75-0317-4411-9814-7e7a79f4b002',
    name: 'Basso Club',
    area: 'Porta Venezia',
    vibe: 'Chill & chatty',
    distanceLabel: '12 min walk',
    distanceMeters: 900,
    isPopular: false,
    image: {
      uri: 'https://images.unsplash.com/photo-1744928869793-3908b4649ad6?auto=format&fit=crop&w=900&q=85',
    },
    communityRating: { average: 4.4, count: 64 },
    crowd: { level: 2, label: 'Easygoing' },
    startingPriceCents: 600,
    bathroomCleanliness: 4.3,
  },
  {
    id: 'b3eaae75-0317-4411-9814-7e7a79f4b003',
    name: 'Nottetempo',
    area: 'Isola',
    vibe: 'Indie & electric',
    distanceLabel: '1.4 km',
    distanceMeters: 1400,
    isPopular: true,
    image: {
      uri: 'https://images.unsplash.com/photo-1707208097739-e3bdf439acb2?auto=format&fit=crop&w=900&q=85',
    },
    communityRating: { average: 4.3, count: 51 },
    crowd: { level: 3, label: 'Lively' },
    startingPriceCents: 400,
    bathroomCleanliness: 4.0,
  },
  {
    id: 'b3eaae75-0317-4411-9814-7e7a79f4b004',
    name: 'Violet Room',
    area: 'Brera',
    vibe: 'Intimate cocktails',
    distanceLabel: null,
    distanceMeters: null,
    isPopular: false,
    image: {
      uri: 'https://images.unsplash.com/photo-1764270720089-63e2a918b51f?auto=format&fit=crop&w=900&q=85',
    },
    // Deliberately incomplete demo venue to exercise honest missing-data states.
    communityRating: null,
    crowd: null,
    startingPriceCents: null,
    bathroomCleanliness: null,
  },
];

export const exploreMockUser = { initials: 'AM' } as const;

function demoDrinks(beerCents: number, spritzCents: number, ginCents: number): VenueDetails['drinks'] {
  return [
    { id: 'b3eaae75-0317-4411-9814-7e7a79f4b101', name: 'Beer', serving: 'Draft · 0.4 L', priceCents: beerCents, currency: 'EUR' },
    { id: 'b3eaae75-0317-4411-9814-7e7a79f4b102', name: 'Aperol Spritz', serving: 'Classic · 250 ml', priceCents: spritzCents, currency: 'EUR' },
    { id: 'b3eaae75-0317-4411-9814-7e7a79f4b103', name: 'Gin & Tonic', serving: 'House gin · 300 ml', priceCents: ginCents, currency: 'EUR' },
  ];
}

// Detail snapshots share the exact Explore UUIDs. Relative ages describe the demo snapshot,
// not a live report feed. No official records or real incidents are included.
export const mockVenueDetails: Partial<Record<string, VenueDetails>> = {
  'b3eaae75-0317-4411-9814-7e7a79f4b001': {
    city: 'Milano',
    address: null,
    openingHoursLabel: 'Sample hours · Until 02:00',
    crowd: { score: 4, reportCount: 12, newestReportAgeMinutes: 8 },
    drinks: demoDrinks(500, 700, 800),
    languages: [{ code: 'it', name: 'Italian' }, { code: 'en', name: 'English' }],
    bathrooms: {
      reviewCount: 28,
      cleanliness: { average: 4.7, count: 28 },
      accessibility: { average: 4.2, count: 25 },
      waitTime: { average: 4.4, count: 26 },
    },
    demoSafetyNotes: [],
  },
  'b3eaae75-0317-4411-9814-7e7a79f4b002': {
    city: 'Milano',
    address: null,
    openingHoursLabel: null,
    crowd: { score: 2, reportCount: 5, newestReportAgeMinutes: 14 },
    drinks: demoDrinks(600, 800, 900),
    languages: [{ code: 'it', name: 'Italian' }, { code: 'en', name: 'English' }, { code: 'es', name: 'Spanish' }],
    bathrooms: {
      reviewCount: 19,
      cleanliness: { average: 4.3, count: 19 },
      accessibility: { average: 3.9, count: 17 },
      waitTime: { average: 4.1, count: 18 },
    },
    demoSafetyNotes: [],
  },
  'b3eaae75-0317-4411-9814-7e7a79f4b003': {
    city: 'Milano',
    address: null,
    openingHoursLabel: null,
    crowd: { score: 3, reportCount: 3, newestReportAgeMinutes: 21 },
    drinks: demoDrinks(400, 600, 700),
    languages: [{ code: 'it', name: 'Italian' }, { code: 'en', name: 'English' }],
    bathrooms: {
      reviewCount: 16,
      cleanliness: { average: 4.0, count: 16 },
      accessibility: { average: null, count: 0 },
      waitTime: { average: 3.8, count: 12 },
    },
    demoSafetyNotes: [],
  },
  'b3eaae75-0317-4411-9814-7e7a79f4b004': {
    city: 'Milano',
    address: null,
    openingHoursLabel: null,
    crowd: { score: null, reportCount: 0, newestReportAgeMinutes: null },
    drinks: [],
    languages: [],
    bathrooms: null,
    demoSafetyNotes: [],
  },
};
