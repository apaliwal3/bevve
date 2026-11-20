import { router } from 'expo-router';

import { PersonalRankingsScreen } from '@/features/rankings/personal-rankings-screen';
import { venueFromRankingsHref } from '@/features/venues/bar-details-navigation';

export default function RankingsRoute() {
  return (
    <PersonalRankingsScreen
      onExplore={() => router.navigate('/explore')}
      onProfile={() => router.navigate('/profile')}
      onOpenVenue={(venue) => router.push(venueFromRankingsHref(venue.id))}
    />
  );
}
