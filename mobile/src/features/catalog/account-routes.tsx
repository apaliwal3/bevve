import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { BevveTheme as theme } from '@/constants/theme';
import { BarDetailsScreen, MissingVenueScreen } from '@/features/venues/bar-details-screen';
import { navigateBackFromBarDetails, resolveBarDetailsBack, venueFromRankingsHref } from '@/features/venues/bar-details-navigation';
import { PriceComparisonScreen } from '@/features/prices/price-comparison-screen';
import { adaptRpcPriceComparison } from '@/features/prices/price-comparison';
import { priceComparisonHref, priceOriginHref, resolvePriceNavigation, venueFromPricesHref, type PriceRouteParams } from '@/features/prices/price-navigation';
import { resolveVenueById } from '@/features/venues/venue-details';
import { useTranslation } from '@/localization/language-provider';
import { catalogDetails, catalogReadData, catalogVenue } from './catalog-adapters';
import { CatalogFeedback } from './catalog-feedback';
import { AccountImpressionEditor } from './account-impression-editor';
import type { AccountCatalogValue } from './catalog-provider';
import { useAccountComparisons } from '@/features/comparisons/account-comparisons-provider';
import { AccountComparisonFeedback } from '@/features/comparisons/account-comparison-panel';
import { RankedVenueRow } from '@/features/rankings/ranked-venue-row';
import { AccountContributionPanel } from '@/features/contributions/account-contribution-panel';
import { AccountLanguagePanel } from '@/features/contributions/account-language-panel';
import { AccountIncidentPanel, AccountPublishedSafety } from '@/features/contributions/account-safety-panel';
import { useAccountLocation } from '@/features/location/account-location-provider';
import { locatedCatalogVenue } from '@/features/location/venue-distance';

export function AccountBarDetailsRoute({ catalog }: { catalog: AccountCatalogValue }) {
  const { t, format } = useTranslation();
  const location = useAccountLocation();
  const params = useLocalSearchParams<PriceRouteParams & { barId?: string | string[]; returnTo?: string | string[] }>();
  const [editing, setEditing] = useState(false);
  const venues = catalog.venues.map(row => locatedCatalogVenue(row, location.fix, t, format));
  const result = resolveVenueById(params.barId, venues);
  const navigation = resolvePriceNavigation(params, catalog.drinks, venues, catalog.drinks[0]?.id ?? null);
  const back = resolveBarDetailsBack(params.returnTo, navigation.drink?.id ?? null, navigation.sourceVenue?.id);
  const goBack = () => navigateBackFromBarDetails(back, router);
  if (catalog.status !== 'ready') return <ScreenContainer><CatalogFeedback catalog={catalog} /><PrimaryButton label={t('Back to Explore')} onPress={() => router.dismissTo('/explore')} /></ScreenContainer>;
  if (result.status !== 'ready') return <MissingVenueScreen reason={result.status} onBack={goBack} />;
  const row = catalog.venues.find(row => row.id === result.venue.id)!;
  return <>
    <BarDetailsScreen venue={result.venue} details={catalogDetails(row)} account={catalogReadData(row, catalog.impressions[row.id])}
      accountSafety={<AccountPublishedSafety key={row.id} barId={row.id} />}
      onBack={goBack} backLabel={t(back.label)} onEditImpression={() => setEditing(true)}
      onComparePrices={() => router.push(priceComparisonHref(navigation.drink?.id ?? catalog.drinks[0]?.id ?? null, row.id))} />
    {editing && <AccountImpressionEditor key={row.id} catalog={catalog} barId={row.id} name={row.name} onClose={() => setEditing(false)}>
      <AccountContributionPanel catalog={catalog} barId={row.id} />
      <AccountLanguagePanel catalog={catalog} barId={row.id} />
      <AccountIncidentPanel catalog={catalog} barId={row.id} />
    </AccountImpressionEditor>}
  </>;
}

export { AccountProfileScreen } from '@/features/profile/account-profile-screen';

export function AccountRankingsScreen({ catalog }: { catalog: AccountCatalogValue }) {
  const { t } = useTranslation();
  const comparisons = useAccountComparisons();
  const { entries, completedCount } = comparisons.rankings;
  const refreshing = comparisons.refreshing || catalog.refreshing;
  function refresh() {
    if (refreshing) return;
    void Promise.allSettled([comparisons.refresh(), catalog.refresh()]);
  }
  return <ScreenContainer contentContainerStyle={styles.content} refreshing={refreshing} onRefresh={refresh}>
    <Text accessibilityRole="header" style={styles.title}>{t('My Rankings')}</Text>
    <Text style={styles.note}>{t('Your preferences, separate from community opinions and bathroom reviews.')}</Text>
    <CatalogFeedback catalog={catalog} />
    <AccountComparisonFeedback />
    {comparisons.status === 'ready' && catalog.status === 'ready' && <>
      <Text accessibilityLiveRegion="polite" style={styles.note}>{t('{count} personal comparisons completed', { count: completedCount })}</Text>
      {entries.map(entry => <View key={entry.venue.id}>
        {catalog.venues.find(row => row.id === entry.venue.id)?.is_demo && <Text style={styles.note}>{t('Sample venue')}</Text>}
        <RankedVenueRow entry={entry} onPress={() => router.push(venueFromRankingsHref(entry.venue.id))} />
      </View>)}
    </>}
    <PrimaryButton label={t('My impressions')} onPress={() => router.navigate('/profile')} />
    <PrimaryButton label={t('Explore venues')} variant="secondary" onPress={() => router.navigate('/explore')} />
  </ScreenContainer>;
}

export function AccountPricesRoute({ catalog }: { catalog: AccountCatalogValue }) {
  const { t } = useTranslation();
  const params = useLocalSearchParams<PriceRouteParams>();
  const venues = catalog.venues.map(catalogVenue);
  const { drink, sourceVenue } = resolvePriceNavigation(params, catalog.drinks, venues, catalog.drinks[0]?.id);
  if (catalog.status !== 'ready') return <ScreenContainer><CatalogFeedback catalog={catalog} /><PrimaryButton label={t('Back to Explore')} onPress={() => router.dismissTo('/explore')} /></ScreenContainer>;
  const request = { p_drink_id: drink?.id ?? '', p_bar_ids: venues.map(venue => venue.id), p_currency: 'EUR' as const };
  const rows = catalog.venues.flatMap(venue => venue.drinks.filter(price => price.id === drink?.id).map(price => ({ bar_id: venue.id, ...price })));
  const comparison = adaptRpcPriceComparison(request, rows, catalog.drinks, venues);
  return <PriceComparisonScreen {...comparison} account catalog={catalog.drinks} drink={drink}
    backLabel={sourceVenue ? t('Back to {name}', { name: sourceVenue.name }) : t('Back to Explore')}
    onBack={() => { if (router.canGoBack()) router.back(); else router.replace(priceOriginHref(sourceVenue)); }}
    onSelectDrink={drink => router.setParams({ drinkId: drink.id })}
    onOpenVenue={venue => { if (drink) router.push(venueFromPricesHref(venue.id, drink.id, sourceVenue?.id)); }} />;
}
const styles = StyleSheet.create({
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 28 },
  note: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 22 },
});
