import { useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/components/app-icon';
import { ExploreScreenContainer as ScreenContainer } from '@/features/explore/explore-screen-container';
import { catalogMapPins } from '@/features/explore/venue-map-data';
import { VenueCard } from '@/components/venue-card';
import { BevveTheme as theme } from '@/constants/theme';
import { useTranslation } from '@/localization/language-provider';
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
  const pins = useMemo(() => catalogMapPins(catalog.status === 'ready' && showRows ? rows : []), [catalog.status, showRows, rows]);
  const [refreshing, setRefreshing] = useState(false);
  const pulling = useRef(false);
  async function refresh() {
    if (pulling.current) return;
    pulling.current = true;
    setRefreshing(true);
    try { await Promise.allSettled([catalog.refresh(), location.refresh()]); }
    finally { pulling.current = false; setRefreshing(false); }
  }
  return <ScreenContainer pins={pins} contentContainerStyle={styles.content} refreshing={refreshing} onRefresh={refresh}>
    <Text accessibilityRole="header" style={styles.title}>{t('Explore venues')}</Text>
    {catalog.venues.some(row => row.is_demo) && <Text style={styles.note}>{t('Sample venues are labeled. Your impressions are saved to your account.')}</Text>}
    <TextInput style={styles.search} accessibilityLabel={t('Search bars or neighborhoods')} placeholder={t('Search bars or neighborhoods')}
      placeholderTextColor={theme.colors.purpleText} value={query} onChangeText={setQuery} autoCorrect={false} />
    <ScrollView horizontal style={styles.filterScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} keyboardShouldPersistTaps="handled">
      {(['All','Nearby','Cheap','Quiet','Popular'] as const).map(item => <Pressable key={item} accessibilityRole="button"
        accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)}
        style={[styles.chip, filter === item && styles.selected]}><Text style={[styles.chipText, filter === item && styles.selectedText]}>{t(item)}</Text></Pressable>)}
    </ScrollView>
    <LocationFeedback />
    <CatalogFeedback catalog={catalog} />
    {catalog.status === 'ready' && <>
      {showRows && rows.map(row => <View key={row.id} style={styles.venue}>
        {row.is_demo && <Text style={styles.note}>{t('Sample venue')}</Text>}
        <VenueCard venue={locatedCatalogVenue(row, location.fix, t, format)} account={catalogReadData(row, catalog.impressions[row.id])}
          onPress={() => router.push({ pathname: '/bars/[barId]', params: { barId: row.id } })} />
      </View>)}
      {showRows && rows.length === 0 && <View accessibilityLiveRegion="polite" style={styles.empty}>
        <View style={styles.emptyIcon}><AppIcon name="explore" size={26} color={theme.colors.purpleLight} /></View>
        <Text accessibilityRole="header" style={styles.emptyTitle}>{query.trim() ? t('No bars found')
          : filter === 'Quiet' ? t('No quiet bars found') : filter === 'Popular' ? t('No popular bars found')
            : filter === 'Nearby' ? t('No bars nearby') : filter === 'Cheap' ? t('No bars found') : t('No venues are available yet.')}</Text>
        <Text style={styles.emptyCopy}>{filter === 'Nearby' ? t('No matching real venues within 1 km of your current location.') : t('Try another neighborhood or filter.')}</Text>
      </View>}
    </>}
  </ScreenContainer>;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.huge, gap: theme.spacing.md },
  title: { fontFamily: theme.fonts.brand, fontSize: 26, color: theme.colors.text },
  note: { fontFamily: theme.fonts.body, color: theme.colors.textMuted, fontSize: 12, lineHeight: 19 },
  search: { backgroundColor: theme.colors.surface, padding: theme.spacing.lg, color: theme.colors.text, fontFamily: theme.fonts.body, borderRadius: theme.radii.button, fontSize: 14 },
  venue: { gap: theme.spacing.sm },
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filters: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: theme.spacing.sm },
  chip: { minHeight: 44, flexShrink: 0, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, justifyContent: 'center', borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface },
  empty: { alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xxxl, paddingHorizontal: theme.spacing.xxl,
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.border },
  emptyIcon: { width: 56, height: 56, borderRadius: theme.radii.pill, backgroundColor: theme.colors.purpleTint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 22, lineHeight: 30, textAlign: 'center' },
  emptyCopy: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  selected: { backgroundColor: theme.colors.purpleButton },
  selectedText: { color: theme.colors.onAccent },
  chipText: { color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 12 },
});
