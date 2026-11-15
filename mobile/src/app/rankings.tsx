import { router, Stack } from 'expo-router';

import { PersonalRankingsScreen } from '@/features/rankings/personal-rankings-screen';
import { venueFromRankingsHref } from '@/features/venues/bar-details-navigation';

export default function RankingsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'My Rankings' }} />
      <PersonalRankingsScreen
        onCompare={() => router.navigate('/compare')}
        onOpenVenue={(venue) => router.push(venueFromRankingsHref(venue.id))}
      />
    </>
  );
}
