import { router } from 'expo-router';

import { ProfileScreen } from '@/features/profile/profile-screen';
import { venueFromProfileHref } from '@/features/venues/bar-details-navigation';
import { useVenueCatalog } from '@/features/catalog/catalog-provider';
import { AccountProfileScreen } from '@/features/catalog/account-routes';

export default function ProfileRoute() {
  const catalog = useVenueCatalog();
  if (catalog.mode === 'account') return <AccountProfileScreen catalog={catalog} />;
  return (
    <ProfileScreen
      onOpenVenue={(venueId) => router.push(venueFromProfileHref(venueId))}
    />
  );
}
