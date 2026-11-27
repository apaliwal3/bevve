import { useTranslation } from '@/localization/language-provider';
import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { Logo } from '@/components/logo';
import { ScreenContainer } from '@/components/screen-container';
import { VenueCard } from '@/components/venue-card';
import { BevveTheme as theme } from '@/constants/theme';
import { filterVenues, venueFilters, type VenueFilter } from '@/features/explore/filter-venues';
import { EXPLORE_HORIZONTAL_PADDING, filterChipLayout } from '@/features/explore/filter-layout';
import { exploreMockUser, mockVenues } from '@/fixtures/venues';
import { usePriceComparisonSelection, useVenueCrowdSelector, useVenuePriceCatalog } from '@/features/ratings/venue-ratings-provider';
import { priceComparisonHref } from '@/features/prices/price-navigation';
import { useVenueCatalog } from '@/features/catalog/catalog-provider';
import { AccountExploreScreen } from '@/features/catalog/account-explore-screen';

export default function ExploreScreen() {
  const catalog = useVenueCatalog();
  return catalog.mode === 'account' ? <AccountExploreScreen catalog={catalog} /> : <DemoExploreScreen />;
}

export function DemoExploreScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VenueFilter>('All');
  const { drinkId } = usePriceComparisonSelection();
  const priceVenues = useVenuePriceCatalog(mockVenues);
  const crowdFor = useVenueCrowdSelector();
  const venues = useMemo(() => filterVenues(priceVenues, query, filter, crowdFor), [priceVenues, query, filter, crowdFor]);

  function resetFilters() {
    setQuery('');
    setFilter('All');
    Keyboard.dismiss();
  }

  return (
    <View style={styles.screen}>
    <ScreenContainer edges={['top', 'left', 'right']} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Logo />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Open demo profile")}
          onPress={() => router.navigate('/profile')}
          style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{exploreMockUser.initials}</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{t("TONIGHT IN MILAN")}</Text>
        <Text accessibilityRole="header" style={styles.title}>{t("Where to") + ' '}<Text style={styles.titleAccent}>{t("tonight?")}</Text>
        </Text>
        <Text style={styles.subtitle}>{t("Real talk from people already there.")}</Text>
        <Text style={styles.demoLabel}>{t('Demo venues · Sample prices and distances')}</Text>
      </View>

      <View style={styles.search}>
        <AppIcon name="explore" size={21} />
        <TextInput
          accessibilityLabel={t("Search bars or neighborhoods")}
          placeholder={t("Search bars or neighborhoods")}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.purpleLight}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={Keyboard.dismiss}
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel={t("Clear search")} onPress={() => setQuery('')} style={styles.clearSearch}>
            <AppIcon name="close" size={16} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        style={styles.filterScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        keyboardShouldPersistTaps="handled">
        {venueFilters.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === item }}
            onPress={() => setFilter(item)}
            style={({ pressed }) => [styles.chip, filter === item && styles.selectedChip, pressed && (filter === item ? styles.selectedChipPressed : styles.pressed)]}>
            {item === 'Nearby' && <View style={styles.nearbyDot} />}
            <Text style={[styles.chipLabel, filter === item && styles.selectedChipLabel]}>{t(item)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {filter === 'Nearby' && <Text style={styles.filterHint}>{t("Within 1 km · Demo distances")}</Text>}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Compare drink prices")}
        accessibilityHint={t("View community-reported prices across Milan")}
        onPress={() => router.push(priceComparisonHref(drinkId))}
        style={({ pressed }) => [styles.priceCard, pressed && styles.pressed]}>
        <View style={styles.euroBadge}><Text style={styles.euro}>€</Text></View>
        <View style={styles.priceCopy}>
          <Text style={styles.priceTitle}>{t("Compare drink prices")}</Text>
          <Text style={styles.priceSubtitle}>{t("Find the cheapest pour nearby")}</Text>
        </View>
        <AppIcon name="chevron" size={18} color={theme.colors.purpleLight} />
      </Pressable>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{filter === 'All' ? t("Happening now") : t(filter)}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.viewAll}>
          <Text style={styles.viewAllLabel}>{t("View all")}</Text>
        </Pressable>
      </View>

      <View style={styles.venueList}>
        {venues.map((venue) => (
          <VenueCard
            key={venue.id}
            venue={venue}
            onPress={() => router.push({ pathname: '/bars/[barId]', params: { barId: venue.id } })}
          />
        ))}
        {venues.length === 0 && (
          <View style={styles.empty}>
            <AppIcon name="explore" size={28} color={theme.colors.purpleLight} />
            <Text style={styles.emptyTitle}>{t("No bars found")}</Text>
            <Text style={styles.emptyCopy}>{t("Try another neighborhood or filter.")}</Text>
            <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.viewAll}>
              <Text style={styles.viewAllLabel}>{t("Clear search and filters")}</Text>
            </Pressable>
          </View>
        )}
      </View>
      <Link href="/" asChild>
        <Pressable style={styles.backLink}><Text style={styles.viewAllLabel}>{t("Back to Welcome")}</Text></Pressable>
      </Link>
    </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: EXPLORE_HORIZONTAL_PADDING,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  avatarButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundImage: `linear-gradient(145deg, ${theme.colors.purpleLight}, ${theme.colors.purple})`
  },
  initials: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11
  },
  hero: {
    paddingTop: 26,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.sm
  },
  eyebrow: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.brand,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.7
  },
  titleAccent: {
    color: theme.colors.purpleLight
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20
  },
  demoLabel: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    lineHeight: 15
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: 52,
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.xs,
    borderRadius: theme.radii.button,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    paddingVertical: theme.spacing.md
  },
  clearSearch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'stretch',
    gap: filterChipLayout.gap,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs
  },
  chip: {
    minHeight: filterChipLayout.minHeight,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: filterChipLayout.paddingHorizontal,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  selectedChip: {
    backgroundColor: theme.colors.purpleButton,
    borderColor: theme.colors.purpleButton
  },
  selectedChipPressed: { backgroundColor: theme.colors.purpleButtonPressed },
  chipLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyBold,
    fontSize: filterChipLayout.fontSize,
    flexShrink: 1,
    textAlign: 'center'
  },
  selectedChipLabel: {
    color: theme.colors.text
  },
  nearbyDot: {
    width: 6,
    height: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.success
  },
  filterHint: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    paddingTop: theme.spacing.sm
  },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radii.button,
    borderWidth: 1,
    borderColor: theme.colors.purpleBorder,
    backgroundColor: theme.colors.purpleTint
  },
  euroBadge: {
    width: 34,
    height: 34,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center'
  },
  euro: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 18
  },
  priceCopy: {
    flex: 1
  },
  priceTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12
  },
  priceSubtitle: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    marginTop: theme.spacing.xs
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.md
  },
  sectionCopy: {
    flex: 1
  },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 19
  },
  viewAll: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm
  },
  viewAllLabel: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12
  },
  venueList: {
    gap: theme.spacing.lg
  },
  empty: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface
  },
  emptyTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 18
  },
  emptyCopy: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    textAlign: 'center'
  },
  backLink: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: theme.spacing.xxl
  },
  pressed: {
    opacity: 0.7
  }
});
