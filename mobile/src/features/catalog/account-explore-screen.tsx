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
import { catalogReadData, catalogVenue } from './catalog-adapters';
import { CatalogFeedback } from './catalog-feedback';
import type { AccountCatalogValue } from './catalog-provider';

export function AccountExploreScreen({ catalog }: { catalog: AccountCatalogValue }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | 'Cheap' | 'Quiet' | 'Popular'>('All');
  const rows = useMemo(() => catalog.venues.filter(row => {
    if (!`${row.name} ${row.area ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (filter === 'Cheap') return row.drinks.some(drink => drink.price_cents <= 500);
    if (filter === 'Quiet') return row.crowd.classification === 'quiet';
    if (filter === 'Popular') return row.is_popular;
    return true;
  }), [catalog.venues, query, filter]);
  return <ScreenContainer edges={['top','left','right']} contentContainerStyle={styles.content}>
    <View style={styles.header}><Logo /><PrimaryButton label={t('Profile')} variant="secondary" onPress={() => router.navigate('/profile')} /></View>
    <Text accessibilityRole="header" style={styles.title}>{t('Explore venues')}</Text>
    <Text style={styles.note}>{t('Open a venue and tap + to save your impression.')}</Text>
    {catalog.venues.some(row => row.is_demo) && <Text style={styles.note}>{t('Sample venues are labeled. Your impressions are saved to your account.')}</Text>}
    <TextInput style={styles.search} accessibilityLabel={t('Search bars or neighborhoods')} placeholder={t('Search bars or neighborhoods')}
      placeholderTextColor={theme.colors.textMuted} value={query} onChangeText={setQuery} autoCorrect={false} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {(['All','Cheap','Quiet','Popular'] as const).map(item => <Pressable key={item} accessibilityRole="button"
        accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)}
        style={[styles.chip, filter === item && styles.selected]}><Text style={styles.chipText}>{t(item)}</Text></Pressable>)}
    </ScrollView>
    <PrimaryButton label={catalog.refreshing ? t('Please wait…') : t('Refresh venues')} disabled={catalog.refreshing}
      variant="secondary" onPress={() => { void catalog.refresh(); }} />
    <CatalogFeedback catalog={catalog} />
    {catalog.status === 'ready' && <>
      <Text accessibilityLiveRegion="polite" style={styles.note}>{t('{count} venues', { count: rows.length })}</Text>
      {rows.map(row => <View key={row.id} style={styles.venue}>
        {row.is_demo && <Text style={styles.note}>{t('Sample venue')}</Text>}
        <VenueCard venue={catalogVenue(row)} account={catalogReadData(row, catalog.impressions[row.id])}
          onPress={() => router.push({ pathname: '/bars/[barId]', params: { barId: row.id } })} />
      </View>)}
      {rows.length === 0 && <Text style={styles.note}>{query ? t('No bars found') : t('No venues are available yet.')}</Text>}
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
