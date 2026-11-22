import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { BevveTheme as theme } from '@/constants/theme';
import { AccountPanel } from '@/features/auth/account-panel';
import { BarDetailsScreen, MissingVenueScreen } from '@/features/venues/bar-details-screen';
import { navigateBackFromBarDetails, resolveBarDetailsBack, venueFromProfileHref } from '@/features/venues/bar-details-navigation';
import { PriceComparisonScreen } from '@/features/prices/price-comparison-screen';
import { adaptRpcPriceComparison } from '@/features/prices/price-comparison';
import { priceComparisonHref, priceOriginHref, resolvePriceNavigation, venueFromPricesHref, type PriceRouteParams } from '@/features/prices/price-navigation';
import { ProfileActivityRow, ProfileActivitySection } from '@/features/profile/profile-activity-components';
import { selectProfileContributions } from '@/features/profile/profile-activity';
import { impressionLabels } from '@/features/impressions/impression-selector';
import { resolveVenueById } from '@/features/venues/venue-details';
import { useTranslation } from '@/localization/language-provider';
import { catalogDetails, catalogReadData, catalogVenue, savedImpressions } from './catalog-adapters';
import { CatalogFeedback } from './catalog-feedback';
import { AccountImpressionEditor } from './account-impression-editor';
import type { AccountCatalogValue } from './catalog-provider';

export function AccountBarDetailsRoute({ catalog }: { catalog: AccountCatalogValue }) {
  const { t } = useTranslation();
  const params = useLocalSearchParams<PriceRouteParams & { barId?: string | string[]; returnTo?: string | string[] }>();
  const [editing, setEditing] = useState(false);
  const venues = catalog.venues.map(catalogVenue);
  const result = resolveVenueById(params.barId, venues);
  const navigation = resolvePriceNavigation(params, catalog.drinks, venues, catalog.drinks[0]?.id ?? null);
  const back = resolveBarDetailsBack(params.returnTo, navigation.drink?.id ?? null, navigation.sourceVenue?.id);
  const goBack = () => navigateBackFromBarDetails(back, router);
  if (catalog.status !== 'ready') return <ScreenContainer><CatalogFeedback catalog={catalog} /><PrimaryButton label={t('Back to Explore')} onPress={() => router.dismissTo('/explore')} /></ScreenContainer>;
  if (result.status !== 'ready') return <MissingVenueScreen reason={result.status} onBack={goBack} />;
  const row = catalog.venues.find(row => row.id === result.venue.id)!;
  return <>
    <BarDetailsScreen venue={result.venue} details={catalogDetails(row)} account={catalogReadData(row, catalog.impressions[row.id])}
      onBack={goBack} backLabel={t(back.label)} onEditImpression={() => setEditing(true)}
      onComparePrices={() => router.push(priceComparisonHref(navigation.drink?.id ?? catalog.drinks[0]?.id ?? null, row.id))} />
    {editing && <AccountImpressionEditor key={row.id} catalog={catalog} barId={row.id} name={row.name} onClose={() => setEditing(false)} />}
  </>;
}

export function AccountProfileScreen({ catalog }: { catalog: AccountCatalogValue }) {
  const { t, format } = useTranslation();
  const activity = selectProfileContributions({ impressions: savedImpressions(catalog.impressions, catalog.venues), crowdReports: [], bathroomReviews: [], priceObservations: [] }, catalog.userId, catalog.venues.map(catalogVenue), catalog.drinks);
  return <ScreenContainer contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>{t('Profile')}</Text>
    <AccountPanel />
    <CatalogFeedback catalog={catalog} />
    {catalog.status === 'ready' && <ProfileActivitySection title={t('My impressions')} count={activity.counts.impressions}
      icon="profile" hint={t('One editable impression per venue, saved to your account.')} emptyHint={t('Open a venue and use + to share your impression.')}>
      {activity.impressions.map(entry => <ProfileActivityRow key={entry.venue.id} venue={entry.venue}
        summary={t('Your impression: {impression} · Updated {date}', { impression: t(impressionLabels[entry.impression]), date: format.dateTime(entry.updatedAt) })}
        onPress={() => router.push(venueFromProfileHref(entry.venue.id))} />)}
    </ProfileActivitySection>}
    <PrimaryButton label={t('Explore venues')} onPress={() => router.navigate('/explore')} />
    <PrimaryButton label={catalog.refreshing ? t('Please wait…') : t('Refresh impressions')} variant="secondary" disabled={catalog.refreshing} onPress={() => { void catalog.refresh(); }} />
  </ScreenContainer>;
}

export function AccountRankingsScreen() {
  const { t } = useTranslation();
  return <ScreenContainer contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>{t('My Rankings')}</Text>
    <Text style={styles.note}>{t('Impressions and rankings are separate. Personal comparisons are coming soon.')}</Text>
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
