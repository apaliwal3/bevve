import { useTranslation } from '@/localization/language-provider';
import { useReducer, useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { mockDrinkCatalog } from '@/fixtures/contribution-catalog';
import { contributionError, drinkCategoryLabel } from '@/localization/venue-copy';

import { emptyPriceDraft, priceDraftReducer } from './extra-form-drafts';
import { inlineFormStyles as styles } from './inline-form-styles';
import { MAX_PRICE_CENTS, MIN_PRICE_CENTS, parseEuroPrice, type VenueDrinkPrice } from './venue-extras-state';

type DrinkPriceFormProps = {
  prices: readonly VenueDrinkPrice[];
  disabled?: boolean;
  onSubmit: (drinkId: string, priceCents: number) => void;
  onCancel: () => void;
};

export function DrinkPriceForm({ prices, disabled = false, onSubmit, onCancel }: DrinkPriceFormProps) {
  const { t, format } = useTranslation();
  const [draft, dispatchDraft] = useReducer(priceDraftReducer, emptyPriceDraft);
  const [success, setSuccess] = useState<{ name: string; priceCents: number } | null>(null);
  const price = parseEuroPrice(draft.euros);
  const selected = mockDrinkCatalog.find((drink) => drink.id === draft.drinkId);

  function cancel() {
    dispatchDraft({ type: 'cancel' });
    setSuccess(null);
    Keyboard.dismiss();
    onCancel();
  }

  function submit() {
    if (!selected || !price.ok || disabled) return;
    onSubmit(selected.id, price.value);
    setSuccess({ name: selected.name, priceCents: price.value });
    Keyboard.dismiss();
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>{t("Select drink")}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t("Drink catalog")} style={styles.form}>
        {mockDrinkCatalog.map((drink) => (
          <Pressable
            key={drink.id}
            accessibilityRole="radio"
            accessibilityLabel={t('{name}, {category}, {volume} millilitres', { name: drink.name, category: drinkCategoryLabel(drink.category, t), volume: format.number(drink.serving_ml) })}
            accessibilityState={{ checked: draft.drinkId === drink.id, disabled }}
            disabled={disabled}
            onPress={() => {
              const savedCents = prices.find((row) => row.id === drink.id)?.priceCents ?? null;
              dispatchDraft({
                type: 'select', drinkId: drink.id, savedCents,
                prefilledEuros: savedCents === null ? undefined : format.decimal(savedCents / 100, 2),
              });
              setSuccess(null);
            }}
            style={({ pressed }) => [styles.option, draft.drinkId === drink.id && styles.selected, pressed && styles.pressed]}>
            <Text style={styles.label}>{drink.name}</Text>
            <Text style={styles.hint}>{t('{category} · {volume} ml', { category: drinkCategoryLabel(drink.category, t), volume: format.number(drink.serving_ml) })}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{t("EUR price (€)")}</Text>
      <TextInput
        accessibilityLabel={t("Drink price in euros")}
        accessibilityHint={t("Use a decimal point or comma, with up to two decimal places")}
        value={draft.euros}
        onChangeText={(euros) => { dispatchDraft({ type: 'price', euros }); setSuccess(null); }}
        editable={!disabled}
        placeholder={t("e.g. 6.50 or 6,50")}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.purpleLight}
        keyboardType="decimal-pad"
        keyboardAppearance="dark"
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        maxLength={16}
        style={styles.input}
      />
      <Text style={styles.hint}>{t('{min}–{max} · Up to two decimals. Serving size comes from the catalog.', { min: format.currency(MIN_PRICE_CENTS), max: format.currency(MAX_PRICE_CENTS) })}</Text>
      {draft.euros.trim().length > 0 && !price.ok && <Text accessibilityLiveRegion="polite" style={styles.error}>{contributionError(price.error, t, format.currency)}</Text>}
      {success && <Text accessibilityLiveRegion="polite" style={styles.success}>{t('{name}: {price} saved for this demo session.', { name: success.name, price: format.currency(success.priceCents) })}</Text>}
      <Text style={styles.hint}>{t("Community-reported, not verified. Corrections save a new observation and keep previous prices in session history.")}</Text>
      <View style={styles.actions}>
        <PrimaryButton label={t("Cancel")} variant="secondary" disabled={disabled} onPress={cancel} style={styles.button} />
        <PrimaryButton label={t("Submit price")} disabled={!selected || !price.ok || disabled} onPress={submit} style={styles.button} />
      </View>
    </View>
  );
}
