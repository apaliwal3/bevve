import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { BevveTheme as theme } from '@/constants/theme';
import { AccountPanel } from '@/features/auth/account-panel';
import { BarDetailsScreen, MissingVenueScreen } from '@/features/venues/bar-details-screen';
import { navigateBackFromBarDetails, resolveBarDetailsBack, venueFromProfileHref, venueFromRankingsHref } from '@/features/venues/bar-details-navigation';
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
import { useAccountComparisons } from '@/features/comparisons/account-comparisons-provider';
import { AccountComparisonFeedback, AccountComparisonPanel } from '@/features/comparisons/account-comparison-panel';
import { RankedVenueRow } from '@/features/rankings/ranked-venue-row';
import { useAccountContributions } from '@/features/contributions/account-contributions-provider';
import { AccountContributionFeedback, AccountContributionPanel } from '@/features/contributions/account-contribution-panel';

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
    {editing && <AccountImpressionEditor key={row.id} catalog={catalog} barId={row.id} name={row.name} onClose={() => setEditing(false)}>
      <AccountComparisonPanel catalog={catalog} barId={row.id} />
      <AccountContributionPanel catalog={catalog} barId={row.id} />
    </AccountImpressionEditor>}
  </>;
}

export function AccountProfileScreen({ catalog }: { catalog: AccountCatalogValue }) {
  const { t, format } = useTranslation();
  const comparisons = useAccountComparisons();
  const contributions = useAccountContributions();
  const activity = selectProfileContributions({ impressions: savedImpressions(catalog.impressions, catalog.venues), crowdReports: contributions.crowds, bathroomReviews: contributions.bathrooms, priceObservations: contributions.prices }, catalog.userId, catalog.venues.map(catalogVenue), catalog.drinks);
  const summary = (barId: string, text: string) => catalog.venues.some(row => row.id === barId && row.is_demo) ? t('Sample venue') + ' · ' + text : text;
  return <ScreenContainer contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>{t('Profile')}</Text>
    <AccountPanel />
    <CatalogFeedback catalog={catalog} />
    <AccountComparisonFeedback />
    <AccountContributionFeedback />
    {comparisons.status === 'ready' && <>
      <Text style={styles.note}>{t('{count} personal comparisons completed', { count: comparisons.rankings.completedCount })}</Text>
      <PrimaryButton label={t('My Rankings')} variant="secondary" onPress={() => router.navigate('/rankings')} />
    </>}
    {catalog.status === 'ready' && <ProfileActivitySection title={t('My impressions')} count={activity.counts.impressions}
      icon="profile" hint={t('One editable impression per venue, saved to your account.')} emptyHint={t('Open a venue and use + to share your impression.')}>
      {activity.impressions.map(entry => <ProfileActivityRow key={entry.venue.id} venue={entry.venue}
        summary={summary(entry.venue.id, t('Your impression: {impression} · Updated {date}', { impression: t(impressionLabels[entry.impression]), date: format.dateTime(entry.updatedAt) }))}
        onPress={() => router.push(venueFromProfileHref(entry.venue.id))} />)}
    </ProfileActivitySection>}
    {contributions.status === 'ready' && <>
      <ProfileActivitySection title={t('My crowd reports')} count={activity.counts.crowdReports} icon="crowd"
        hint={t('All your saved reports, including earlier submissions. These are not a live crowd consensus.')} emptyHint={t('Report a crowd level from a venue’s + overlay.')}>
        {activity.crowds.map(entry => <ProfileActivityRow key={entry.id} venue={entry.venue}
          summary={summary(entry.venue.id, t('Reported crowd level {level}/5 · {date}', { level:entry.level,date:format.dateTime(entry.submittedAt) }))}
          onPress={()=>router.push(venueFromProfileHref(entry.venue.id))} />)}
      </ProfileActivitySection>
      <ProfileActivitySection title={t('My bathroom reviews')} count={activity.counts.bathroomReviews} icon="bathroom"
        hint={t('One editable review per venue. A waiting-time score of 5 means a shorter wait.')} emptyHint={t('Rate cleanliness, accessibility and waiting time in a venue’s + overlay.')}>
        {activity.bathrooms.map(entry => <ProfileActivityRow key={entry.id} venue={entry.venue}
          summary={summary(entry.venue.id, t('Cleanliness {clean}/5 · Accessibility {access} · Waiting time {wait} · Updated {date}', { clean:entry.cleanliness,
            access:entry.accessibility===null?t('Unavailable'):t('{score}/5',{score:entry.accessibility}),wait:entry.waitTime===null?t('Unavailable'):t('{score}/5',{score:entry.waitTime}),date:format.dateTime(entry.updatedAt) }))}
          onPress={()=>router.push(venueFromProfileHref(entry.venue.id))} />)}
      </ProfileActivitySection>
      <ProfileActivitySection title={t('My price observations')} count={activity.counts.priceObservations} icon="euro"
        hint={t('Community-reported, not verified. Corrections retain earlier observations.')} emptyHint={t('Submit a catalog drink price from a venue’s + overlay.')}>
        {activity.prices.map(entry => <ProfileActivityRow key={entry.id} venue={entry.venue}
          summary={summary(entry.venue.id, t('{drink} · {price} · {date}', {drink:entry.servingMl===null?t('Drink unavailable'):t('{name} · {volume} ml',{name:entry.drinkName,volume:entry.servingMl}),price:format.currency(entry.priceCents),date:format.dateTime(entry.observedAt)}))}
          onPress={()=>router.push(venueFromProfileHref(entry.venue.id))} />)}
      </ProfileActivitySection>
    </>}
    <PrimaryButton label={t('Explore venues')} onPress={() => router.navigate('/explore')} />
    <PrimaryButton label={catalog.refreshing ? t('Please wait…') : t('Refresh impressions')} variant="secondary" disabled={catalog.refreshing} onPress={() => { void catalog.refresh(); }} />
    <PrimaryButton label={contributions.refreshing ? t('Please wait…') : t('Refresh contributions')} variant="secondary" disabled={contributions.refreshing} onPress={() => { void contributions.refresh(); catalog.invalidate(); }} />
  </ScreenContainer>;
}

export function AccountRankingsScreen({ catalog }: { catalog: AccountCatalogValue }) {
  const { t } = useTranslation();
  const comparisons = useAccountComparisons();
  const { entries, completedCount } = comparisons.rankings;
  return <ScreenContainer contentContainerStyle={styles.content}>
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
      {entries.length === 0 && <Text style={styles.note}>{t('Open a bar in Explore and tap + to save your impression. Comparisons with bars you have experienced build your ranking.')}</Text>}
    </>}
    <PrimaryButton label={comparisons.refreshing || catalog.refreshing ? t('Please wait…') : t('Refresh rankings')} disabled={comparisons.refreshing || catalog.refreshing} variant="secondary"
      onPress={() => { void comparisons.refresh(); void catalog.refresh(); }} />
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
