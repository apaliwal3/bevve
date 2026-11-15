import type { Venue } from '@/types/venue';

// Figma-inspired demo data only. Not connected to the backend seed or any live venue.
export const mockVenues: Venue[] = [
  {
    id: 'b3eaae75-0317-4411-9814-7e7a79f4b001',
    name: 'Luna Rossa',
    area: 'Navigli',
    vibe: 'Loud & social',
    distanceLabel: '8 min walk',
    image: {
      uri: 'https://images.unsplash.com/photo-1546847596-b6c8086514d0?auto=format&fit=crop&w=900&q=85',
    },
    communityRating: { average: 4.7, count: 86 },
    crowd: { level: 4, label: 'Buzzing' },
    startingPriceCents: 500,
    bathroomCleanliness: 4.7,
  },
];
