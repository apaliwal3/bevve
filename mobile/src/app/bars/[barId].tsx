import { router, useLocalSearchParams } from 'expo-router';

import { BarDetailsScreen, MissingVenueScreen } from '@/features/venues/bar-details-screen';
import { resolveVenueById } from '@/features/venues/venue-details';
import { mockVenueDetails, mockVenues } from '@/fixtures/venues';

export default function BarDetailsRoute() {
  const { barId } = useLocalSearchParams<{ barId?: string | string[] }>();
  const result = resolveVenueById(barId, mockVenues);
  const backToExplore = () => router.dismissTo('/explore');

  if (result.status !== 'ready') {
    return <MissingVenueScreen reason={result.status} onBack={backToExplore} />;
  }

  return (
    <BarDetailsScreen
      key={result.venue.id}
      venue={result.venue}
      details={mockVenueDetails[result.venue.id]}
      onBack={backToExplore}
    />
  );
}
