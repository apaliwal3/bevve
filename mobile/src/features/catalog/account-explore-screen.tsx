import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Logo } from '@/components/logo';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { VenueCard } from '@/components/venue-card';
import { BevveTheme as theme } from '@/constants/theme';
import { useTranslation } from '@/localization/language-provider';
import { priceComparisonHref } from '@/features/prices/price-navigation';
import { catalogReadData } from './catalog-adapters';
import { CatalogFeedback } from './catalog-feedback';
import type { AccountCatalogValue } from './catalog-provider';
import { useAccountLocation } from '@/features/location/account-location-provider';
import { LocationFeedback } from '@/features/location/location-feedback';
import { locatedCatalogVenue, selectAccountVenues, type AccountVenueFilter } from '@/features/location/venue-distance';

export function AccountExploreScreen({ catalog }: { catalog: AccountCatalogValue }) {
  const { t, format } = useTranslation();
  const location = useAccountLocation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AccountVenueFilter>('All');
  const rows = useMemo(() => selectAccountVenues(catalog.venues, query, filter, location.fix), [catalog.venues, query, filter, location.fix]);
  const showRows = filter !== 'Nearby' || location.status === 'ready' && location.fix !== null;
  const refreshing = catalog.refreshing || location.enabled && (location.status === 'checking' || location.status === 'locating');
  function refresh() {
    if (refreshing) return;
    void catalog.refresh();
    if (location.enabled) void location.refresh();
  }
  return <ScreenContainer edges={['top','left','right']} contentContainerStyle={styles.content} refreshing={refreshing} onRefresh={refresh}>
    <View style={styles.header}><Logo /><PrimaryButton label={t('Profile')} variant="secondary" onPress={() => router.navigate('/profile')} /></View>
    <Text accessibilityRole="header" style={styles.title}>{t('Explore venues')}</Text>
    {catalog.venues.some(row => row.is_demo) && <Text style={styles.note}>{t('Sample venues are labeled. Your impressions are saved to your account.')}</Text>}
    <TextInput style={styles.search} accessibilityLabel={t('Search bars or neighborhoods')} placeholder={t('Search bars or neighborhoods')}
      placeholderTextColor={theme.colors.textMuted} value={query} onChangeText={setQuery} autoCorrect={false} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {(['All','Nearby','Cheap','Quiet','Popular'] as const).map(item => <Pressable key={item} accessibilityRole="button"
        accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)}
        style={[styles.chip, filter === item && styles.selected]}><Text style={styles.chipText}>{t(item)}</Text></Pressable>)}
    </ScrollView>
    <LocationFeedback />
    <CatalogFeedback catalog={catalog} />
    {catalog.status === 'ready' && <>
      {showRows && rows.map(row => <View key={row.id} style={styles.venue}>
        {row.is_demo && <Text style={styles.note}>{t('Sample venue')}</Text>}
        <VenueCard venue={locatedCatalogVenue(row, location.fix, t, format)} account={catalogReadData(row, catalog.impressions[row.id])}
          onPress={() => router.push({ pathname: '/bars/[barId]', params: { barId: row.id } })} />
      </View>)}
      {showRows && rows.length === 0 && <Text style={styles.note}>{filter === 'Nearby' ? t('No matching real venues within 1 km of your current location.') : query ? t('No bars found') : t('No venues are available yet.')}</Text>}
      <PrimaryButton label={t('Compare drink prices')} variant="secondary" onPress={() => router.push(priceComparisonHref(catalog.drinks[0]?.id ?? null))} />
    </>}
  </ScreenContainer>;
}
const styles = StyleSheet.create({
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: theme.fonts.brand, fontSize: 32, color: theme.colors.text },
  note: { fontFamily: theme.fonts.body, color: theme.colors.textMuted, fontSize: 12, lineHeight: 19 },
  search: { backgroundColor: theme.colors.surface, padding: theme.spacing.lg, color: theme.colors.text, fontFamily: theme.fonts.body, borderRadius: theme.radii.button, fontSize: 14 },
  venue: { gap: theme.spacing.sm },
  filters: { flexDirection: 'row', gap: theme.spacing.sm },
  chip: { minHeight: 44, paddingHorizontal: theme.spacing.lg, justifyContent: 'center', borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface },
  selected: { backgroundColor: theme.colors.purpleButton },
  chipText: { color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 12 },
});
