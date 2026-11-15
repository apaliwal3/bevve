import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import AppTabs from '@/components/app-tabs';
import { CrowdMeter } from '@/components/crowd-meter';
import { Logo } from '@/components/logo';
import { PreviewNotice } from '@/components/preview-notice';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { BevveTheme as theme } from '@/constants/theme';
import type { UUID } from '@/features/comparisons/comparison-state';
import { usePersonalRankings } from '@/features/comparisons/personal-comparisons-provider';
import { formatEuroCents } from '@/features/prices/price-comparison';
import { useProfileContributions } from '@/features/ratings/venue-ratings-provider';
import { exploreMockUser } from '@/fixtures/venues';

import { ProfileActivityRow, ProfileActivitySection } from './profile-activity-components';

type ProfileScreenProps = {
  onOpenVenue: (venueId: UUID) => void;
  onCompare: () => void;
  onRankings: () => void;
  onWelcome: () => void;
};
const reportDate = (time: string) => new Date(time).toLocaleString();

export function ProfileScreen({ onOpenVenue, onCompare, onRankings, onWelcome }: ProfileScreenProps) {
  const activity = useProfileContributions();
  const personal = usePersonalRankings();
  const [languageNotice, setLanguageNotice] = useState(false);

  return (
    <View style={styles.screen}>
      <ScreenContainer edges={['top', 'left', 'right']} contentContainerStyle={styles.content}>
        <View style={styles.header}><Logo /><Text style={styles.pill}>MY ACTIVITY</Text></View>
        <View style={styles.hero}>
          <View accessibilityLabel="Demo avatar" style={styles.avatar}><Text style={styles.initials}>{exploreMockUser.initials}</Text></View>
          <Text accessibilityRole="header" style={styles.name}>Demo profile</Text>
          <Text style={styles.pill}>DEMO SESSION</Text>
          <Text style={styles.description}>No authenticated account or email is connected.</Text>
          <View style={styles.stats}>
            <ProfileStat value={activity.counts.ratings} label="Ratings" />
            <ProfileStat value={activity.updatesCount} label="Updates" />
            <ProfileStat value={personal.completedCount} label="Comparisons" />
          </View>
          <Text style={styles.note}>Updates include crowd reports, bathroom reviews and price observations.</Text>
        </View>

        <ProfileActivitySection title="My overall bar ratings" count={activity.counts.ratings} icon="star" emptyHint="Open a venue and use + to rate your overall experience.">
          {activity.ratings.map((entry) => (
            <ProfileActivityRow key={entry.venue.id} venue={entry.venue} summary={entry.venue.area + ' · Your overall rating: ' + entry.rating + '/5'}
              trailing={<Text style={styles.stars}>{'★'.repeat(entry.rating)}{'☆'.repeat(5 - entry.rating)}</Text>}
              onPress={() => onOpenVenue(entry.venue.id)} />
          ))}
        </ProfileActivitySection>
        <ProfileActivitySection title="My crowd reports" count={activity.counts.crowdReports} icon="crowd"
          hint="All your session submissions, including earlier reports. These are not a live crowd consensus."
          emptyHint="Report a crowd level from a venue’s + overlay.">
          {activity.crowds.map((entry) => (
            <ProfileActivityRow key={entry.id} venue={entry.venue} summary={'Reported crowd level ' + entry.level + '/5 · ' + reportDate(entry.submittedAt)}
              trailing={<CrowdMeter level={entry.level} />} onPress={() => onOpenVenue(entry.venue.id)} />
          ))}
        </ProfileActivitySection>
        <ProfileActivitySection title="My bathroom reviews" count={activity.counts.bathroomReviews} icon="bathroom"
          hint="One editable review per venue. A waiting-time score of 5 means a shorter wait."
          emptyHint="Rate cleanliness, accessibility and waiting time in a venue’s + overlay.">
          {activity.bathrooms.map((entry) => (
            <ProfileActivityRow key={entry.venue.id} venue={entry.venue}
              summary={'Cleanliness ' + entry.cleanliness + '/5 · Accessibility ' + entry.accessibility + '/5 · Waiting time ' + entry.waitTime + '/5 · Updated ' + reportDate(entry.updatedAt)}
              onPress={() => onOpenVenue(entry.venue.id)} />
          ))}
        </ProfileActivitySection>
        <ProfileActivitySection title="My price observations" count={activity.counts.priceObservations} icon="euro"
          hint="Community-reported, not verified. Corrections retain earlier observations."
          emptyHint="Submit a catalog drink price from a venue’s + overlay.">
          {activity.prices.map((entry) => (
            <ProfileActivityRow key={entry.id} venue={entry.venue}
              summary={entry.drinkName + (entry.servingMl === null ? '' : ' · ' + entry.servingMl + ' ml') + ' · ' + formatEuroCents(entry.priceCents) + ' · ' + reportDate(entry.observedAt)}
              onPress={() => onOpenVenue(entry.venue.id)} />
          ))}
        </ProfileActivitySection>
        <ProfileActivitySection title="My personal rankings" count={personal.entries.length} icon="rankings"
          hint={personal.completedCount + ' personal comparisons completed. Skips do not count. Ordering is separate from community ratings.'}
          emptyHint="Choose the bar you prefer in Compare to start your personal ranking.">
          {personal.entries.map((entry) => (
            <ProfileActivityRow key={entry.venue.id} venue={{ ...entry.venue, available: true }} summary={entry.venue.area + ' · Personal position #' + entry.position}
              trailing={<Text style={styles.ordinal}>#{entry.position}</Text>} onPress={() => onOpenVenue(entry.venue.id)} />
          ))}
        </ProfileActivitySection>
        <PrimaryButton label="Continue comparing" onPress={onCompare} />
        <PrimaryButton label="View My Rankings" variant="secondary" onPress={onRankings} />

        <View style={styles.settings}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Settings</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="App language, English" accessibilityHint="English and Italian switching is planned for Stage 7C"
            onPress={() => setLanguageNotice(true)} style={({ pressed }) => [styles.languageRow, pressed && styles.pressed]}>
            <AppIcon name="languages" size={21} color={theme.colors.purpleLight} />
            <View style={styles.languageCopy}>
              <Text style={styles.settingLabel}>App language</Text>
              <Text style={styles.note}>Separate from languages spoken at bars.</Text>
              <Text style={styles.note}>English / Italian switching · Stage 7C</Text>
            </View>
            <Text style={styles.languageValue}>English</Text>
          </Pressable>
          {languageNotice && <PreviewNotice message="Language switching is coming in Stage 7C. The app remains in English." onDismiss={() => setLanguageNotice(false)} />}
          <PrimaryButton label="Return to Welcome" variant="secondary" onPress={onWelcome} />
          <Text style={styles.note}>Returning to Welcome keeps demo activity for this app session. A full reload may clear it.</Text>
        </View>
        <Text style={styles.note}>Pending language suggestions and private incident reports are not included in these activity summaries.</Text>
      </ScreenContainer>
      <AppTabs />
    </View>
  );
}

function ProfileStat({ value, label }: { value: number; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
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
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  pill: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.purpleBorder,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.purpleTint
  },
  hero: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.md
  },
  avatar: {
    width: 83,
    height: 83,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
    borderWidth: 4,
    borderColor: theme.colors.purpleBorder,
    marginBottom: theme.spacing.sm,
    backgroundImage: 'linear-gradient(145deg, ' + theme.colors.purpleLight + ', ' + theme.colors.purple + ')'
  },
  initials: {
    color: theme.colors.text,
    fontFamily: theme.fonts.brand,
    fontSize: 24
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.fonts.brand,
    fontSize: 25
  },
  description: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center'
  },
  stats: {
    width: '100%',
    flexDirection: 'row',
    marginTop: theme.spacing.md
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs
  },
  statValue: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 22
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    textAlign: 'center'
  },
  note: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 18
  },
  stars: {
    color: theme.colors.star,
    fontSize: 14
  },
  ordinal: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.brand,
    fontSize: 14
  },
  settings: {
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 17
  },
  languageRow: {
    minHeight: 64,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm
  },
  languageCopy: {
    flex: 1,
    minWidth: 120,
    gap: theme.spacing.xs
  },
  settingLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13
  },
  languageValue: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12
  },
  pressed: {
    opacity: 0.75
  }
});
