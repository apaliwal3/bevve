import { router } from 'expo-router';

import { PersonalRankingsScreen } from '@/features/rankings/personal-rankings-screen';
import { venueFromRankingsHref } from '@/features/venues/bar-details-navigation';
import { useVenueCatalog } from '@/features/catalog/catalog-provider';
import { AccountRankingsScreen } from '@/features/catalog/account-routes';

export default function RankingsRoute() {
  const catalog = useVenueCatalog();
  if (catalog.mode === 'account') return <AccountRankingsScreen />;
  return (
    <PersonalRankingsScreen
      onExplore={() => router.navigate('/explore')}
      onProfile={() => router.navigate('/profile')}
      onOpenVenue={(venue) => router.push(venueFromRankingsHref(venue.id))}
    />
  );
}
