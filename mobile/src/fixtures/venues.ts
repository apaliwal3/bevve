import type { Venue } from '@/types/venue';

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
