import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from '@/localization/language-provider';

import { BarDetailsScreen, MissingVenueScreen } from '@/features/venues/bar-details-screen';
import { resolveVenueById } from '@/features/venues/venue-details';
import { mockVenueDetails, mockVenues } from '@/fixtures/venues';
import { mockDrinkCatalog } from '@/fixtures/contribution-catalog';
import { priceComparisonHref, resolvePriceNavigation, type PriceRouteParams } from '@/features/prices/price-navigation';
import { usePriceComparisonSelection } from '@/features/ratings/venue-ratings-provider';
import { navigateBackFromBarDetails, resolveBarDetailsBack } from '@/features/venues/bar-details-navigation';
import { useVenueCatalog } from '@/features/catalog/catalog-provider';
import { AccountBarDetailsRoute } from '@/features/catalog/account-routes';

export default function BarDetailsRoute() {
  const catalog = useVenueCatalog();
  return catalog.mode === 'account' ? <AccountBarDetailsRoute catalog={catalog} /> : <DemoBarDetailsRoute />;
}

function DemoBarDetailsRoute() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<PriceRouteParams & { barId?: string | string[]; returnTo?: string | string[] }>();
  const { barId } = params;
  const { drinkId: preferredDrinkId } = usePriceComparisonSelection();
  const { drink, sourceVenue } = resolvePriceNavigation(params, mockDrinkCatalog, mockVenues, preferredDrinkId);
  const result = resolveVenueById(barId, mockVenues);
  const backToExplore = () => router.dismissTo('/explore');
  const backPlan = resolveBarDetailsBack(params.returnTo, drink?.id ?? preferredDrinkId, sourceVenue?.id);
  const goBack = () => navigateBackFromBarDetails(backPlan, router);

  if (result.status !== 'ready') {
    return <MissingVenueScreen reason={result.status} onBack={backToExplore} />;
  }

  return (
    <BarDetailsScreen
      key={result.venue.id}
      venue={result.venue}
      details={mockVenueDetails[result.venue.id]}
      onBack={goBack}
      backLabel={t(backPlan.label)}
      onComparePrices={() => router.push(priceComparisonHref(drink?.id ?? preferredDrinkId, result.venue.id))}
    />
  );
}
