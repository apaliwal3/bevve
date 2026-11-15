import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';
import type { CatalogDrink } from '@/fixtures/contribution-catalog';

type DrinkSelectorProps = {
  catalog: readonly CatalogDrink[];
  selectedId: string | null;
  onSelect: (drink: CatalogDrink) => void;
};

export function DrinkSelector({ catalog, selectedId, onSelect }: DrinkSelectorProps) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Drink to compare" style={styles.options}>
      {catalog.map((drink) => {
        const selected = drink.id === selectedId;
        return (
          <Pressable
            key={drink.id}
            accessibilityRole="radio"
            accessibilityLabel={`${drink.name}, ${drink.category}, ${drink.serving_ml} millilitres`}
            accessibilityState={{ checked: selected }}
            onPress={() => onSelect(drink)}
            style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}>
            <View style={[styles.initial, selected && styles.selectedInitial]}>
              <Text style={[styles.initialText, selected && styles.selectedText]}>{drink.name[0]}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={[styles.name, selected && styles.selectedText]}>{drink.name}</Text>
              <Text style={styles.serving}>{drink.serving_ml} ml</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  option: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 125,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  selected: {
    borderColor: theme.colors.purple,
    backgroundColor: theme.colors.purpleTint
  },
  initial: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceRaised
  },
  selectedInitial: {
    backgroundColor: theme.colors.purple
  },
  initialText: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xxs
  },
  name: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12
  },
  selectedText: {
    color: theme.colors.text
  },
  serving: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 10
  },
  pressed: {
    opacity: 0.7
  }
});
