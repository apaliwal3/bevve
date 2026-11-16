import { useTranslation } from '@/localization/language-provider';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { BevveTheme as theme } from '@/constants/theme';
import type { Venue } from '@/types/venue';

import type { PriceComparisonRow } from './price-comparison';

type PriceResultRowProps = {
  venue: Venue;
  quote: PriceComparisonRow | null;
  servingMl: number;
  position?: number;
  isLowest?: boolean;
  onPress: () => void;
};

export function PriceResultRow({ venue, quote, servingMl, position, isLowest = false, onPress }: PriceResultRowProps) {
  const { t, format } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const price = quote ? format.currency(quote.priceCents) : t('No price yet');
  const date = quote?.observedAt
    ? t('Reported {date}', { date: format.dateTime(quote.observedAt) })
    : quote ? t('Date unavailable · Demo snapshot') : t('No observation');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('{name}, {area}, {price}, {volume} millilitres. {date}. Open Bar Details', { name: venue.name, area: venue.area, price, volume: format.number(servingMl), date })}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Text style={[styles.position, isLowest && styles.best]}>{quote ? isLowest ? t("BEST") : position : '—'}</Text>
      <View style={styles.photo}>
        {venue.image && !imageFailed
          ? <Image source={venue.image} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} onError={() => setImageFailed(true)} />
          : <AppIcon name="photo" size={19} />}
      </View>
      <View style={styles.copy}>
        <View style={styles.heading}>
          <Text style={styles.name}>{venue.name}</Text>
          <Text style={[styles.price, !quote && styles.missingPrice]}>{price}</Text>
        </View>
        <Text style={styles.area}>{venue.area}</Text>
        <Text style={styles.meta}>{servingMl} ml · {date}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md
  },
  position: {
    width: 24,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11
  },
  best: {
    color: theme.colors.success,
    fontSize: 9
  },
  photo: {
    width: 43,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceRaised,
    overflow: 'hidden'
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs
  },
  heading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: theme.spacing.sm,
    rowGap: theme.spacing.xs
  },
  name: {
    flexGrow: 1,
    flexShrink: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 12
  },
  price: {
    color: theme.colors.text,
    fontFamily: theme.fonts.brand,
    fontSize: 17
  },
  missingPrice: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11
  },
  area: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.body,
    fontSize: 11
  },
  meta: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    lineHeight: 16
  },
  pressed: {
    opacity: 0.7
  }
});
