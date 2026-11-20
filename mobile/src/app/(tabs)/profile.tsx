import { router } from 'expo-router';

import { ProfileScreen } from '@/features/profile/profile-screen';
import { venueFromProfileHref } from '@/features/venues/bar-details-navigation';

export default function ProfileRoute() {
  return (
    <ProfileScreen
      onOpenVenue={(venueId) => router.push(venueFromProfileHref(venueId))}
      onExplore={() => router.navigate('/explore')}
      onRankings={() => router.navigate('/rankings')}
      onWelcome={() => router.dismissTo('/')}
    />
  );
}
