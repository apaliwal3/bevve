import { router, useLocalSearchParams } from 'expo-router';

import { BarDetailsScreen, MissingVenueScreen } from '@/features/venues/bar-details-screen';
import { resolveVenueById } from '@/features/venues/venue-details';
import { mockVenueDetails, mockVenues } from '@/fixtures/venues';
import { mockDrinkCatalog } from '@/fixtures/contribution-catalog';
import { priceComparisonHref, resolvePriceNavigation, type PriceRouteParams } from '@/features/prices/price-navigation';
import { usePriceComparisonSelection } from '@/features/ratings/venue-ratings-provider';

export default function BarDetailsRoute() {
  const params = useLocalSearchParams<PriceRouteParams & { barId?: string | string[]; returnTo?: string | string[] }>();
  const { barId } = params;
  const { drinkId: preferredDrinkId } = usePriceComparisonSelection();
  const { drink, sourceVenue } = resolvePriceNavigation(params, mockDrinkCatalog, mockVenues, preferredDrinkId);
  const fromPrices = params.returnTo === 'prices';
  const result = resolveVenueById(barId, mockVenues);
  const backToExplore = () => router.dismissTo('/explore');
  const goBack = () => {
    if (!fromPrices) backToExplore();
    else if (router.canGoBack()) router.back();
    else router.replace(priceComparisonHref(drink?.id ?? preferredDrinkId, sourceVenue?.id));
  };

  if (result.status !== 'ready') {
    return <MissingVenueScreen reason={result.status} onBack={backToExplore} />;
  }

  return (
    <BarDetailsScreen
      key={result.venue.id}
      venue={result.venue}
      details={mockVenueDetails[result.venue.id]}
      onBack={goBack}
      backLabel={fromPrices ? 'Back to drink prices' : 'Back to Explore'}
      onComparePrices={() => router.push(priceComparisonHref(drink?.id ?? preferredDrinkId, result.venue.id))}
    />
  );
}
