import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import AppTabs from '@/components/app-tabs';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { BevveTheme as theme } from '@/constants/theme';
import { usePersonalRankings } from '@/features/comparisons/personal-comparisons-provider';
import { exploreMockUser } from '@/fixtures/venues';

import type { RankedVenue } from './personal-rankings';
import { RankedVenueRow } from './ranked-venue-row';

type PersonalRankingsScreenProps = { onCompare: () => void; onOpenVenue: (venue: RankedVenue) => void; onProfile: () => void };

export function PersonalRankingsScreen({ onCompare, onOpenVenue, onProfile }: PersonalRankingsScreenProps) {
  const { entries, completedCount } = usePersonalRankings();
  const hasRankings = entries.length > 0;

  return (
    <View style={styles.screen}>
      <ScreenContainer edges={['top', 'left', 'right']} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>YOUR TASTE</Text>
            <Text accessibilityRole="header" style={styles.title}>My Rankings</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open demo profile" onPress={onProfile} style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
            <View style={styles.avatar}><Text style={styles.initials}>{exploreMockUser.initials}</Text></View>
          </Pressable>
        </View>

        <View style={styles.tasteCard}>
          <View accessibilityLabel={entries.length + ' bars ranked'} style={styles.orb}>
            <Text style={styles.orbCount}>{entries.length}</Text>
            <Text style={styles.orbLabel}>RANKED</Text>
          </View>
          <View style={styles.tasteCopy}>
            <Text style={styles.sectionLabel}>YOUR NIGHTLIFE DNA</Text>
            <Text style={styles.cardTitle}>{hasRankings ? 'Your personal order' : 'Make it personal'}</Text>
            <Text style={styles.description}>Ranked by your head-to-head picks. Order updates immediately as you compare.</Text>
          </View>
        </View>
        <Text style={styles.description}>Your preferences, separate from community star ratings and bathroom reviews.</Text>
        <Text accessibilityLiveRegion="polite" style={styles.completed}>{completedCount} personal {completedCount === 1 ? 'comparison' : 'comparisons'} completed</Text>

        <View style={styles.rankingHeading}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Your top bars</Text>
          <Text style={styles.meta}>Personal ranking</Text>
        </View>
        {hasRankings ? (
          <View style={styles.list}>
            {entries.map((entry, index) => (
              <View key={entry.venue.id} style={index > 0 && styles.separator}>
                <RankedVenueRow entry={entry} onPress={() => onOpenVenue(entry.venue)} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <AppIcon name="rankings" size={32} color={theme.colors.purpleLight} />
            <Text style={styles.emptyTitle}>Your ranking starts with a choice</Text>
            <Text style={styles.description}>Compare two bars and pick the one you prefer. Your personal order will appear here.</Text>
          </View>
        )}
        <PrimaryButton label={hasRankings ? 'Compare more bars' : 'Start comparing'} onPress={onCompare} />
        <Text style={styles.note}>Only bars you have compared appear here. Every choice helps refine your personal order.</Text>
        <Text style={styles.note}>DEMO SESSION · Rankings reset on a full app reload.</Text>
      </ScreenContainer>
      <AppTabs />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md
  },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md
  },
  headerCopy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  kicker: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.brand,
    fontSize: 29,
    letterSpacing: -1
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
    backgroundImage: 'linear-gradient(145deg, ' + theme.colors.purpleLight + ', ' + theme.colors.purple + ')'
  },
  initials: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11
  },
  tasteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.purpleBorder,
    backgroundImage: 'linear-gradient(135deg, ' + theme.colors.purpleTint + ', ' + theme.colors.surface + ')'
  },
  orb: {
    width: 67,
    height: 67,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.colors.purpleBorder,
    backgroundImage: 'linear-gradient(135deg, ' + theme.colors.purpleLight + ', ' + theme.colors.purple + ')'
  },
  orbCount: {
    color: theme.colors.text,
    fontFamily: theme.fonts.brand,
    fontSize: 22
  },
  orbLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1
  },
  tasteCopy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  sectionLabel: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8
  },
  cardTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 17
  },
  description: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 19
  },
  completed: {
    color: theme.colors.purpleText,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    lineHeight: 18
  },
  rankingHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md
  },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 18
  },
  meta: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11
  },
  list: {
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card
  },
  separator: {
    borderTopWidth: 1,
    borderColor: theme.colors.border
  },
  empty: {
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xxl,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface
  },
  emptyTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 19,
    textAlign: 'center'
  },
  note: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center'
  },
  pressed: {
    opacity: 0.75
  }
});
