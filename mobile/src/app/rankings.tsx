import { useTranslation } from '@/localization/language-provider';
import { router, Stack } from 'expo-router';

import { PersonalRankingsScreen } from '@/features/rankings/personal-rankings-screen';
import { venueFromRankingsHref } from '@/features/venues/bar-details-navigation';

export default function RankingsRoute() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t("My Rankings") }} />
      <PersonalRankingsScreen
        onCompare={() => router.navigate('/compare')}
        onProfile={() => router.navigate('/profile')}
        onOpenVenue={(venue) => router.push(venueFromRankingsHref(venue.id))}
      />
    </>
  );
}
