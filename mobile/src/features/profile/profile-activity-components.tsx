import { Image } from 'expo-image';
import { useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon, type AppIconName } from '@/components/app-icon';
import { BevveTheme as theme } from '@/constants/theme';
import { useTranslation } from '@/localization/language-provider';
import type { ProfileVenue } from './profile-activity';

export function ProfileActivityRow({ venue, title, summary, date, sample = false, onPress }: {
  venue: ProfileVenue; title?: string; summary: string; date?: string | null; sample?: boolean; onPress: () => void;
}) {
  const { t } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const name = venue.available ? venue.name : t('Venue unavailable');
  const area = venue.available && venue.area !== 'Neighborhood unavailable' ? venue.area : t('Neighborhood unavailable');
  return <Pressable accessibilityRole="button"
    accessibilityLabel={[title ?? name, area, summary, sample ? t('Sample venue') : null, date, venue.available ? t('View Bar Details') : null].filter(Boolean).join('. ')}
    accessibilityState={{ disabled: !venue.available }} disabled={!venue.available} onPress={onPress}
    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <View style={styles.photo}>
      {venue.image && !imageFailed
        ? <Image source={venue.image} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} onError={() => setImageFailed(true)} />
        : <AppIcon name="photo" size={22} />}
    </View>
    <View style={styles.copy}>
      <Text style={styles.title}>{title ?? name}</Text>
      <Text style={styles.area}>{area}</Text>
      {sample && <Text style={styles.area}>{t('Sample venue')}</Text>}
      <Text style={styles.summary}>{summary}</Text>
      {date && <Text style={styles.date}>{date}</Text>}
    </View>
  </Pressable>;
}

export function ProfileEmptyState({ title, message }: { title: string; message: string }) {
  return <View style={styles.empty}>
    <AppIcon name="profile" size={28} color={theme.colors.purpleLight} />
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    <Text style={styles.area}>{message}</Text>
  </View>;
}

const styles = StyleSheet.create({
  row: { minHeight: 100, flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 20, borderBottomWidth: 1, borderColor: theme.colors.border },
  photo: { width: 52, height: 52, borderRadius: 18, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  copy: { flex: 1, minWidth: 0, gap: 5 },
  title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 16 },
  area: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 13 },
  summary: { color: theme.colors.purpleText, fontFamily: theme.fonts.body, fontSize: 13, marginTop: 4 },
  date: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 8 },
  empty: { paddingVertical: 30, paddingHorizontal: 20, gap: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.card, backgroundColor: theme.colors.surface },
  pressed: { opacity: 0.75 },
});

type ActivitySectionProps = PropsWithChildren<{
  title: string; count: number; showCount?: boolean; icon: AppIconName | 'euro'; hint?: string; emptyHint?: string; embedded?: boolean;
}>;

export function ProfileActivitySection({ title, count, showCount = true, icon, hint, emptyHint, children, embedded = false }: ActivitySectionProps) {
  const { t, format } = useTranslation();
  return (
    <View style={embedded ? sectionStyles.embedded : sectionStyles.section}>
      {!embedded && <View style={sectionStyles.heading}>
        <View style={sectionStyles.icon}>
          {icon === 'euro'
            ? <Text accessible={false} style={sectionStyles.symbol}>€</Text>
            : <AppIcon name={icon} size={17} color={theme.colors.purpleLight} />}
        </View>
        <Text accessibilityRole="header" style={sectionStyles.title}>{title}</Text>
        {showCount && <Text style={sectionStyles.count}>{format.number(count)}</Text>}
      </View>}
      {!embedded && hint && <Text style={sectionStyles.hint}>{hint}</Text>}
      {count === 0 ? (
        <View style={embedded ? sectionStyles.embedded : sectionStyles.empty}>
          <Text style={sectionStyles.emptyTitle}>{t("No activity yet")}</Text>
          {emptyHint && <Text style={sectionStyles.hint}>{emptyHint}</Text>}
        </View>
      ) : <View style={sectionStyles.rows}>{children}</View>}
    </View>
  );
}


const sectionStyles = StyleSheet.create({
  embedded: { gap: theme.spacing.sm },
  section: {
    gap: theme.spacing.md,
    padding: 15,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  icon: {
    width: 31,
    height: 31,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.purpleTint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  symbol: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 18
  },
  title: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 15
  },
  count: {
    color: theme.colors.purpleText,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13
  },
  hint: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 18
  },
  empty: {
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border
  },
  emptyTitle: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12
  },
  rows: {
    gap: theme.spacing.sm
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised
  },
  photo: {
    width: 34,
    height: 34,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  copy: {
    flex: 1,
    minWidth: 100,
    gap: theme.spacing.xs
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12
  },
  summary: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 18
  },
  pressed: {
    opacity: 0.75
  }
});
