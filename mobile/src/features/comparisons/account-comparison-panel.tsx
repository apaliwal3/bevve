import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { catalogVenue } from '@/features/catalog/catalog-adapters';
import type { AccountCatalogValue } from '@/features/catalog/catalog-provider';
import { useTranslation } from '@/localization/language-provider';
import { useAccountComparisons } from './account-comparisons-provider';
import { PreferenceVenueCard } from './preference-venue-card';

export function AccountComparisonFeedback() {
  const comparisons = useAccountComparisons();
  const { t } = useTranslation();
  if (comparisons.status === 'ready' && !comparisons.error) return null;
  return <View style={styles.section}>
    <Text style={styles.note} accessibilityRole={comparisons.error ? 'alert' : undefined}>
      {comparisons.error ? comparisons.status === 'ready' ? t('Could not refresh. Showing the last loaded data.')
        : t('Your comparisons could not be loaded.') : t('Loading your comparisons…')}
    </Text>
    {comparisons.error && <PrimaryButton label={t('Retry comparisons')} disabled={comparisons.refreshing} variant="secondary" onPress={() => { void comparisons.refresh(); }} />}
  </View>;
}

export function AccountComparisonPanel({ catalog, barId, journey = false }: { catalog: AccountCatalogValue; barId: string; journey?: boolean }) {
  const comparisons = useAccountComparisons();
  const { t } = useTranslation();
  const batch = comparisons.batches[barId];
  const opponentId = batch?.opponents[batch.round];
  const opponent = catalog.venues.find(row => row.id === opponentId);
  const current = catalog.venues.find(row => row.id === barId);
  const token = batch ? { barId, batchId: batch.id, round: batch.round } : null;
  const hasImpression = Boolean(catalog.impressions[barId]);
  const hasOpponents = catalog.venues.some(row => row.id !== barId && catalog.impressions[row.id]);
  function choose(winnerId: string) {
    if (token) void comparisons.choose(token, winnerId).catch(() => {});
  }
  const pair = current && opponent && batch ? (batch.round % 2 === 0 ? [current, opponent] : [opponent, current]) : [];
  return <View style={styles.section}>
    {!journey && <>
      <Text accessibilityRole="header" style={styles.heading}>{t('Personal comparisons')}</Text>
      <Text style={styles.note}>{t('Only your explicit picks build your ranking. Skipping creates no vote.')}</Text>
    </>}
    <AccountComparisonFeedback />
    {comparisons.status === 'ready' && <>
      {!hasImpression ? <Text style={styles.note}>{t('Save your impression before comparing this venue.')}</Text>
        : !hasOpponents && !opponentId ? <Text style={styles.note}>{t('Save an impression for another venue to start comparing.')}</Text>
        : opponentId && batch && token ? <>
          <Text accessibilityLiveRegion="polite" style={styles.note}>{t('Comparison {current} of {total}', { current: batch.round + 1, total: batch.opponents.length })}</Text>
          <Text style={styles.heading}>{journey ? t('Which would you rather revisit?') : t('Which do you prefer?')}</Text>
          {journey && <Text style={styles.note}>{t('Your personal choices are separate from your saved impression.')}</Text>}
          {pair.length === 2 ? pair.map((row, index) => <View key={row.id}>
            {row.is_demo && <Text style={styles.note}>{t('Sample venue')}</Text>}
            <PreferenceVenueCard venue={catalogVenue(row)}
            otherName={pair[1 - index].name} compact selected={batch.attempt?.winnerId === row.id} faded={Boolean(batch.attempt && batch.attempt.winnerId !== row.id)}
            disabled={batch.saving || Boolean(batch.attempt)} onChoose={() => choose(row.id)} />
          </View>)
            : <Text style={styles.note}>{t('A venue in this comparison is unavailable. Refresh venues and try again.')}</Text>}
          {batch.saving && <Text accessibilityLiveRegion="polite" style={styles.note}>{t('Saving your choice…')}</Text>}
          {batch.error && <>
            <Text accessibilityRole="alert" style={styles.note}>{t('Your choice could not be confirmed. Retry the same choice to avoid a duplicate vote.')}</Text>
            <PrimaryButton label={t('Retry choice')} disabled={batch.saving} onPress={() => { if (batch.attempt) choose(batch.attempt.winnerId); }} />
          </>}
          <PrimaryButton label={t('Skip this comparison')} variant="secondary" disabled={batch.saving || Boolean(batch.attempt)} onPress={() => comparisons.skip(token)} />
          <PrimaryButton label={t('Skip remaining comparisons')} variant="secondary" disabled={batch.saving || Boolean(batch.attempt)} onPress={() => comparisons.skip(token, true)} />
        </> : !journey && <>
          {batch && <Text accessibilityLiveRegion="polite" style={styles.note}>{t('Comparison batch finished.')}</Text>}
          <PrimaryButton label={batch ? t('Compare this bar again') : t('Start comparisons')} disabled={Boolean(catalog.saving[barId])}
            onPress={() => comparisons.begin(barId, batch?.id ?? null)} />
        </>}
    </>}
    {!journey && <Text style={styles.note}>{t('Saved choices survive reloads. Unfinished batches reset when the app restarts or you sign out.')}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: theme.spacing.md },
  heading: { fontFamily: theme.fonts.heading, fontSize: 18, color: theme.colors.text },
  note: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 20, color: theme.colors.textMuted },
});
