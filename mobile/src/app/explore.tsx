import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { Logo } from '@/components/logo';
import { PreviewNotice } from '@/components/preview-notice';
import { ScreenContainer } from '@/components/screen-container';
import { VenueCard } from '@/components/venue-card';
import { BevveTheme as theme } from '@/constants/theme';
import { filterVenues, venueFilters, type VenueFilter } from '@/features/explore/filter-venues';
import { exploreMockUser, mockVenues } from '@/fixtures/venues';

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VenueFilter>('All');
  const [notice, setNotice] = useState<'profile' | 'prices' | null>(null);
  const venues = useMemo(() => filterVenues(mockVenues, query, filter), [query, filter]);

  function resetFilters() {
    setQuery('');
    setFilter('All');
    Keyboard.dismiss();
  }

  return (
    <ScreenContainer edges={['top', 'left', 'right']} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Logo />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile"
          accessibilityHint="Coming soon"
          onPress={() => setNotice('profile')}
          style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{exploreMockUser.initials}</Text>
            <View style={styles.avatarDot} />
          </View>
        </Pressable>
      </View>
      {notice === 'profile' && (
        <PreviewNotice message="Your profile is coming soon." onDismiss={() => setNotice(null)} />
      )}

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>TONIGHT IN MILAN</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Where to <Text style={styles.titleAccent}>tonight?</Text>
        </Text>
        <Text style={styles.subtitle}>Real talk from people already there.</Text>
        <Text style={styles.demoLabel}>Demo venues · Sample prices, ratings and distances</Text>
      </View>

      <View style={styles.search}>
        <AppIcon name="explore" size={21} />
        <TextInput
          accessibilityLabel="Search bars or neighborhoods"
          placeholder="Search bars or neighborhoods"
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
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clearSearch}>
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
            style={({ pressed }) => [styles.chip, filter === item && styles.selectedChip, pressed && styles.pressed]}>
            {item === 'Nearby' && <View style={styles.nearbyDot} />}
            <Text style={[styles.chipLabel, filter === item && styles.selectedChipLabel]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {filter === 'Nearby' && <Text style={styles.filterHint}>Within 1 km · Demo distances</Text>}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Compare drink prices"
        accessibilityHint="Coming soon"
        onPress={() => setNotice('prices')}
        style={({ pressed }) => [styles.priceCard, pressed && styles.pressed]}>
        <View style={styles.euroBadge}><Text style={styles.euro}>€</Text></View>
        <View style={styles.priceCopy}>
          <Text style={styles.priceTitle}>Compare drink prices</Text>
          <Text style={styles.priceSubtitle}>Find the cheapest pour nearby</Text>
        </View>
        <AppIcon name="chevron" size={18} color={theme.colors.purpleLight} />
      </Pressable>

      {notice === 'prices' && (
        <PreviewNotice message="Drink price comparison is coming soon." onDismiss={() => setNotice(null)} />
      )}

      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{filter === 'All' ? 'Happening now' : filter}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.resultCount}>{venues.length} {venues.length === 1 ? 'place' : 'places'} for your night</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.viewAll}>
          <Text style={styles.viewAllLabel}>View all</Text>
        </Pressable>
      </View>

      <View style={styles.venueList}>
        {venues.map((venue) => <VenueCard key={venue.id} venue={venue} />)}
        {venues.length === 0 && (
          <View style={styles.empty}>
            <AppIcon name="explore" size={28} color={theme.colors.purpleLight} />
            <Text style={styles.emptyTitle}>No bars found</Text>
            <Text style={styles.emptyCopy}>Try another neighborhood or filter.</Text>
            <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.viewAll}>
              <Text style={styles.viewAllLabel}>Clear search and filters</Text>
            </Pressable>
          </View>
        )}
      </View>
      <Link href="/" asChild>
        <Pressable style={styles.backLink}><Text style={styles.viewAllLabel}>Back to Welcome</Text></Pressable>
      </Link>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
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
  avatarDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 9,
    height: 9,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.background
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
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs
  },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: 13,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  selectedChip: {
    backgroundColor: theme.colors.purple,
    borderColor: theme.colors.purple
  },
  chipLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12
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
  resultCount: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    marginTop: theme.spacing.xs
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
