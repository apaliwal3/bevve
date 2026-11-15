import { useTranslation } from '@/localization/language-provider';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import AppTabs from '@/components/app-tabs';
import { CrowdMeter } from '@/components/crowd-meter';
import { Logo } from '@/components/logo';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { BevveTheme as theme } from '@/constants/theme';
import type { UUID } from '@/features/comparisons/comparison-state';
import { usePersonalRankings } from '@/features/comparisons/personal-comparisons-provider';
import { languages } from '@/localization/translation';
import { useProfileContributions } from '@/features/ratings/venue-ratings-provider';
import { exploreMockUser } from '@/fixtures/venues';

import { ProfileActivityRow, ProfileActivitySection } from './profile-activity-components';
import { languagePreferenceFeedback } from './language-preference-feedback';

type ProfileScreenProps = {
  onOpenVenue: (venueId: UUID) => void;
  onCompare: () => void;
  onRankings: () => void;
  onWelcome: () => void;
};

export function ProfileScreen({ onOpenVenue, onCompare, onRankings, onWelcome }: ProfileScreenProps) {
  const { t, format, language, setLanguage, persistent, saving, error } = useTranslation();
  const activity = useProfileContributions();
  const personal = usePersonalRankings();

  return (
    <View style={styles.screen}>
      <ScreenContainer edges={['top', 'left', 'right']} contentContainerStyle={styles.content}>
        <View style={styles.header}><Logo /><Text style={styles.pill}>{t("MY ACTIVITY")}</Text></View>
        <View style={styles.hero}>
          <View accessibilityLabel={t("Demo avatar")} style={styles.avatar}><Text style={styles.initials}>{exploreMockUser.initials}</Text></View>
          <Text accessibilityRole="header" style={styles.name}>{t("Demo profile")}</Text>
          <Text style={styles.pill}>{t("DEMO SESSION")}</Text>
          <Text style={styles.description}>{t("No authenticated account or email is connected.")}</Text>
          <View style={styles.stats}>
            <ProfileStat value={activity.counts.ratings} label={t("Ratings")} />
            <ProfileStat value={activity.updatesCount} label={t("Updates")} />
            <ProfileStat value={personal.completedCount} label={t("Comparisons")} />
          </View>
          <Text style={styles.note}>{t("Updates include crowd reports, bathroom reviews and price observations.")}</Text>
        </View>

        <ProfileActivitySection title={t("My overall bar ratings")} count={activity.counts.ratings} icon="star" emptyHint={t("Open a venue and use + to rate your overall experience.")}>
          {activity.ratings.map((entry) => (
            <ProfileActivityRow key={entry.venue.id} venue={entry.venue} summary={t('{area} · Your overall rating: {rating}/5', { area: entry.venue.available ? entry.venue.area : t('Neighborhood unavailable'), rating: entry.rating })}
              trailing={<Text style={styles.stars}>{'★'.repeat(entry.rating)}{'☆'.repeat(5 - entry.rating)}</Text>}
              onPress={() => onOpenVenue(entry.venue.id)} />
          ))}
        </ProfileActivitySection>
        <ProfileActivitySection title={t("My crowd reports")} count={activity.counts.crowdReports} icon="crowd"
          hint={t("All your session submissions, including earlier reports. These are not a live crowd consensus.")}
          emptyHint={t("Report a crowd level from a venue’s + overlay.")}>
          {activity.crowds.map((entry) => (
            <ProfileActivityRow key={entry.id} venue={entry.venue} summary={t('Reported crowd level {level}/5 · {date}', { level: entry.level, date: format.dateTime(entry.submittedAt) })}
              trailing={<CrowdMeter level={entry.level} />} onPress={() => onOpenVenue(entry.venue.id)} />
          ))}
        </ProfileActivitySection>
        <ProfileActivitySection title={t("My bathroom reviews")} count={activity.counts.bathroomReviews} icon="bathroom"
          hint={t("One editable review per venue. A waiting-time score of 5 means a shorter wait.")}
          emptyHint={t("Rate cleanliness, accessibility and waiting time in a venue’s + overlay.")}>
          {activity.bathrooms.map((entry) => (
            <ProfileActivityRow key={entry.venue.id} venue={entry.venue}
              summary={t('Cleanliness {clean}/5 · Accessibility {access}/5 · Waiting time {wait}/5 · Updated {date}', { clean: entry.cleanliness, access: entry.accessibility, wait: entry.waitTime, date: format.dateTime(entry.updatedAt) })}
              onPress={() => onOpenVenue(entry.venue.id)} />
          ))}
        </ProfileActivitySection>
        <ProfileActivitySection title={t("My price observations")} count={activity.counts.priceObservations} icon="euro"
          hint={t("Community-reported, not verified. Corrections retain earlier observations.")}
          emptyHint={t("Submit a catalog drink price from a venue’s + overlay.")}>
          {activity.prices.map((entry) => (
            <ProfileActivityRow key={entry.id} venue={entry.venue}
              summary={(entry.servingMl === null ? t('Drink unavailable') : entry.drinkName) + (entry.servingMl === null ? '' : ' · ' + entry.servingMl + ' ml') + ' · ' + format.currency(entry.priceCents) + ' · ' + format.dateTime(entry.observedAt)}
              onPress={() => onOpenVenue(entry.venue.id)} />
          ))}
        </ProfileActivitySection>
        <ProfileActivitySection title={t("My personal rankings")} count={personal.entries.length} icon="rankings"
          hint={t('{count} personal comparisons completed. Skips do not count. Ordering is separate from community ratings.', { count: personal.completedCount })}
          emptyHint={t("Choose the bar you prefer in Compare to start your personal ranking.")}>
          {personal.entries.map((entry) => (
            <ProfileActivityRow key={entry.venue.id} venue={{ ...entry.venue, available: true }} summary={t('{area} · Personal position #{position}', { area: entry.venue.area, position: entry.position })}
              trailing={<Text style={styles.ordinal}>#{entry.position}</Text>} onPress={() => onOpenVenue(entry.venue.id)} />
          ))}
        </ProfileActivitySection>
        <PrimaryButton label={t("Continue comparing")} onPress={onCompare} />
        <PrimaryButton label={t("View My Rankings")} variant="secondary" onPress={onRankings} />

        <View style={styles.settings}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{t("Settings")}</Text>
          <View style={styles.languageRow}>
            <AppIcon name="languages" size={21} color={theme.colors.purpleLight} />
            <View style={styles.languageCopy}>
              <Text style={styles.settingLabel}>{t("App language")}</Text>
              <Text style={styles.note}>{t("Separate from languages spoken at bars.")}</Text>
            </View>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('Interface language')} style={styles.languageChoices}>
            {languages.map((item) => (
              <Pressable key={item.code} accessibilityRole="radio" accessibilityLabel={item.label}
                accessibilityState={{ checked: language === item.code }}
                onPress={() => { void setLanguage(item.code); }}
                style={({ pressed }) => [styles.languageChoice, language === item.code && styles.languageSelected, pressed && styles.pressed]}>
                <Text style={styles.languageValue}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.note}>
            {t(languagePreferenceFeedback({ error, saving, persistent }))}
          </Text>
          <PrimaryButton label={t("Return to Welcome")} variant="secondary" onPress={onWelcome} />
          <Text style={styles.note}>{t("Returning to Welcome keeps demo activity for this app session. A full reload may clear it.")}</Text>
        </View>
        <Text style={styles.note}>{t("Pending language suggestions and private incident reports are not included in these activity summaries.")}</Text>
      </ScreenContainer>
      <AppTabs />
    </View>
  );
}

function ProfileStat({ value, label }: { value: number; label: string }) {
  const { format } = useTranslation();
  return <View style={styles.stat}><Text style={styles.statValue}>{format.number(value)}</Text><Text style={styles.statLabel}>{label}</Text></View>;
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
  languageChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  languageChoice: { flexGrow: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised },
  languageSelected: { borderColor: theme.colors.purpleLight, backgroundColor: theme.colors.purpleTint },
  pressed: {
    opacity: 0.75
  }
});
