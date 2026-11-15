import { useTranslation } from '@/localization/language-provider';
import { router, Stack } from 'expo-router';

import { ProfileScreen } from '@/features/profile/profile-screen';
import { venueFromProfileHref } from '@/features/venues/bar-details-navigation';

export default function ProfileRoute() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t("Demo profile") }} />
      <ProfileScreen
        onOpenVenue={(venueId) => router.push(venueFromProfileHref(venueId))}
        onCompare={() => router.navigate('/compare')}
        onRankings={() => router.navigate('/rankings')}
        onWelcome={() => router.dismissTo('/')}
      />
    </>
  );
}
