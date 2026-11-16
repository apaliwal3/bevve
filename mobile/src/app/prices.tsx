import { useTranslation } from '@/localization/language-provider';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { PriceComparisonScreen } from '@/features/prices/price-comparison-screen';
import { priceOriginHref, resolvePriceNavigation, venueFromPricesHref, type PriceRouteParams } from '@/features/prices/price-navigation';
import { usePriceComparisonResults, usePriceComparisonSelection } from '@/features/ratings/venue-ratings-provider';
import { mockDrinkCatalog } from '@/fixtures/contribution-catalog';
import { mockVenues } from '@/fixtures/venues';

export default function PricesRoute() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<PriceRouteParams>();
  const { drinkId: preferredDrinkId, selectDrink } = usePriceComparisonSelection();
  // A background price screen keeps its own selection when another instance is opened.
  const [initialDrinkId] = useState(preferredDrinkId);
  const { drink, sourceVenue } = resolvePriceNavigation(params, mockDrinkCatalog, mockVenues, initialDrinkId);
  const comparison = usePriceComparisonResults(drink);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace(priceOriginHref(sourceVenue));
  }

  return (
    <>
      <Stack.Screen options={{ title: t("Compare drink prices across Milan") }} />
      <PriceComparisonScreen
        {...comparison}
        catalog={mockDrinkCatalog}
        drink={drink}
        backLabel={sourceVenue ? t('Back to {name}', { name: sourceVenue.name }) : t('Back to Explore')}
        onBack={goBack}
        onSelectDrink={(selected) => {
          selectDrink(selected.id);
          router.setParams({ drinkId: selected.id });
        }}
        onOpenVenue={(venue) => {
          if (drink) router.push(venueFromPricesHref(venue.id, drink.id, sourceVenue?.id));
        }}
      />
    </>
  );
}
