import { useTranslation } from '@/localization/language-provider';
import { Image } from 'expo-image';
import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { BevveTheme as theme } from '@/constants/theme';
import type { ProfileVenue } from './profile-activity';

type ActivitySectionProps = PropsWithChildren<{
  title: string; count: number; icon: AppIconName | 'euro'; hint?: string; emptyHint: string;
}>;

export function ProfileActivitySection({ title, count, icon, hint, emptyHint, children }: ActivitySectionProps) {
  const { t, format } = useTranslation();
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={styles.icon}>
          {icon === 'euro'
            ? <Text accessible={false} style={styles.symbol}>€</Text>
            : <AppIcon name={icon} size={17} color={theme.colors.purpleLight} />}
        </View>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.count}>{format.number(count)}</Text>
      </View>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {count === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t("No activity yet")}</Text>
          <Text style={styles.hint}>{emptyHint}</Text>
        </View>
      ) : <View style={styles.rows}>{children}</View>}
    </View>
  );
}

type ActivityRowProps = {
  venue: ProfileVenue;
  summary: string;
  trailing?: ReactNode;
  onPress: () => void;
};

export function ProfileActivityRow({ venue, summary, trailing, onPress }: ActivityRowProps) {
  const { t } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const name = venue.available ? venue.name : t('Venue unavailable');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('{name}, {summary}. View Bar Details', { name, summary })}
      accessibilityState={{ disabled: !venue.available }}
      disabled={!venue.available}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.photo}>
        {venue.image && !imageFailed
          ? <Image source={venue.image} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} onError={() => setImageFailed(true)} />
          : <AppIcon name="photo" size={18} />}
      </View>
      <View style={styles.copy}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.summary}>{summary}</Text>
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
