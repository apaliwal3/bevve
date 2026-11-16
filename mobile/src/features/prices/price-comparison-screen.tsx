import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/localization/language-provider';

import { AppIcon } from '@/components/app-icon';
import { FlowHeader } from '@/components/flow-header';
import { ScreenContainer } from '@/components/screen-container';
import { BevveTheme as theme } from '@/constants/theme';
import type { CatalogDrink } from '@/fixtures/contribution-catalog';
import type { Venue } from '@/types/venue';
import { drinkCategoryLabel } from '@/localization/venue-copy';

import { DrinkSelector } from './drink-selector';
import type { PriceComparison } from './price-comparison';
import { PriceResultRow } from './price-result-row';

type PriceComparisonScreenProps = PriceComparison & {
  catalog: readonly CatalogDrink[];
  drink: CatalogDrink | null;
  backLabel: string;
  onBack: () => void;
  onSelectDrink: (drink: CatalogDrink) => void;
  onOpenVenue: (venue: Venue) => void;
};

export function PriceComparisonScreen({ catalog, drink, rows, missingVenues, backLabel, onBack, onSelectDrink, onOpenVenue }: PriceComparisonScreenProps) {
  const { t, format } = useTranslation();
  const lowest = rows[0];
  const highest = rows[rows.length - 1];

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <FlowHeader eyebrow={t('SMARTER NIGHTS')} title={t('Drink prices')} backLabel={backLabel} onBack={onBack} />
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.title}>{t("What are you drinking?")}</Text>
        <Text style={styles.description}>{t("Community-reported prices from bars across Milan.")}</Text>
      </View>

      <DrinkSelector catalog={catalog} selectedId={drink?.id ?? null} onSelect={onSelectDrink} />
      {drink ? (
        <View style={styles.selection}>
          <Text style={styles.selectedDrink}>{drink.name} · {drink.serving_ml} ml</Text>
          <Text style={styles.meta}>{drinkCategoryLabel(drink.category, t)} · {t('Same catalog drink and serving at every venue')}</Text>
        </View>
      ) : <Text style={[styles.description, styles.selection]}>{t("Choose an available drink above to see matching prices.")}</Text>}
      <Text style={styles.demoLabel}>{t("READ-ONLY · DEMO DATA · COMMUNITY-REPORTED")}</Text>

      {lowest && highest && (
        <View style={styles.summary}>
          <View style={styles.summaryPrice}>
            <Text style={styles.summaryLabel}>{t("LOWEST REPORTED")}</Text>
            <Text style={styles.lowestPrice}>{format.currency(lowest.priceCents)}</Text>
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.description}>{lowest.venue.name}</Text>
            <Text style={styles.meta}>
              {rows.length > 1
                ? t('{price} spread across reported prices', { price: format.currency(highest.priceCents - lowest.priceCents) })
                : t("Only one venue has a price for this serving")}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.resultsHeading}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{t("Cheapest first")}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.meta}>{t('{count} prices', { count: rows.length })}</Text>
      </View>
      {rows.length > 0 ? (
        <View style={styles.list}>
          {rows.map((quote, index) => (
            <View key={quote.venue.id} style={index > 0 && styles.separator}>
              <PriceResultRow
                venue={quote.venue} quote={quote} servingMl={quote.servingMl} position={index + 1}
                isLowest={quote.priceCents === lowest.priceCents} onPress={() => onOpenVenue(quote.venue)}
              />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <AppIcon name="compare" size={26} color={theme.colors.purpleLight} />
          <Text style={styles.sectionTitle}>{drink ? t("No matching prices yet") : t("Select a drink")}</Text>
          <Text style={styles.description}>{drink ? t('No reported EUR prices for {name}, {volume} ml.', { name: drink.name, volume: format.number(drink.serving_ml) }) : t("Only drinks from the catalog can be compared.")}</Text>
        </View>
      )}

      {drink && missingVenues.length > 0 && (
        <>
          <View style={styles.resultsHeading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{t("No price reported")}</Text>
            <Text style={styles.meta}>{t('{count} venues', { count: missingVenues.length })}</Text>
          </View>
          <View style={styles.list}>
            {missingVenues.map((venue, index) => (
              <View key={venue.id} style={index > 0 && styles.separator}>
                <PriceResultRow venue={venue} quote={null} servingMl={drink.serving_ml} onPress={() => onOpenVenue(venue)} />
              </View>
            ))}
          </View>
        </>
      )}
      <Text style={styles.note}>{t("Community-reported, not verified. Observation dates are shown when available. Open a venue and use + to report a price.")}</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.xxxl
  },
  intro: {
    paddingTop: theme.spacing.xxxl,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 24,
    letterSpacing: -0.7
  },
  description: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 19
  },
  meta: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 18
  },
  selection: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.xs
  },
  selectedDrink: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13
  },
  demoLabel: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 9,
    lineHeight: 16,
    marginTop: theme.spacing.md
  },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    minHeight: 82,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
    backgroundImage: `linear-gradient(120deg, ${theme.colors.successTint}, ${theme.colors.surface})`
  },
  summaryPrice: {
    paddingRight: theme.spacing.lg,
    borderRightWidth: 1,
    borderColor: theme.colors.successBorder,
    gap: theme.spacing.xs
  },
  summaryLabel: {
    color: theme.colors.success,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.5
  },
  lowestPrice: {
    color: theme.colors.success,
    fontFamily: theme.fonts.brand,
    fontSize: 28
  },
  summaryCopy: {
    flex: 1,
    minWidth: 100,
    gap: theme.spacing.xs
  },
  resultsHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.md
  },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 17
  },
  list: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md
  },
  separator: {
    borderTopWidth: 1,
    borderColor: theme.colors.border
  },
  empty: {
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xxl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card
  },
  note: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: theme.spacing.lg
  }
});
