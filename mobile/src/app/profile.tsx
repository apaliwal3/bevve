import { router, Stack } from 'expo-router';

import { ProfileScreen } from '@/features/profile/profile-screen';
import { venueFromProfileHref } from '@/features/venues/bar-details-navigation';

export default function ProfileRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Demo profile' }} />
      <ProfileScreen
        onOpenVenue={(venueId) => router.push(venueFromProfileHref(venueId))}
        onCompare={() => router.navigate('/compare')}
        onRankings={() => router.navigate('/rankings')}
        onWelcome={() => router.dismissTo('/')}
      />
    </>
  );
}
