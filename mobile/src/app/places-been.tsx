import { useVenueCatalog } from '@/features/catalog/catalog-provider';
import { useSavedImpressions } from '@/features/comparisons/personal-comparisons-provider';
import { useProfileContributions } from '@/features/ratings/venue-ratings-provider';
import { AccountProfileScreen } from '@/features/profile/account-profile-screen';
import { PlacesBeenScreen } from '@/features/profile/places-been-screen';

export default function PlacesBeenRoute() {
  const catalog = useVenueCatalog();
  if (catalog.mode === 'account') return <AccountProfileScreen catalog={catalog} places />;
  return <DemoPlacesBeen />;
}
function DemoPlacesBeen() {
  const impressions = useSavedImpressions();
  const activity = useProfileContributions(impressions);
  return <PlacesBeenScreen activity={activity} />;
}
