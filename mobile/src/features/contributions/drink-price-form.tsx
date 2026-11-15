import { useReducer, useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { mockDrinkCatalog } from '@/fixtures/contribution-catalog';

import { emptyPriceDraft, priceDraftReducer } from './extra-form-drafts';
import { inlineFormStyles as styles } from './inline-form-styles';
import { parseEuroPrice, type VenueDrinkPrice } from './venue-extras-state';

type DrinkPriceFormProps = {
  prices: readonly VenueDrinkPrice[];
  disabled?: boolean;
  onSubmit: (drinkId: string, priceCents: number) => void;
  onCancel: () => void;
};

export function DrinkPriceForm({ prices, disabled = false, onSubmit, onCancel }: DrinkPriceFormProps) {
  const [draft, dispatchDraft] = useReducer(priceDraftReducer, emptyPriceDraft);
  const [success, setSuccess] = useState<string | null>(null);
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
    setSuccess(`${selected.name}: €${(price.value / 100).toFixed(2)} saved for this demo session.`);
    Keyboard.dismiss();
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Select drink</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Drink catalog" style={styles.form}>
        {mockDrinkCatalog.map((drink) => (
          <Pressable
            key={drink.id}
            accessibilityRole="radio"
            accessibilityLabel={`${drink.name}, ${drink.category}, ${drink.serving_ml} millilitres`}
            accessibilityState={{ checked: draft.drinkId === drink.id, disabled }}
            disabled={disabled}
            onPress={() => {
              dispatchDraft({ type: 'select', drinkId: drink.id, savedCents: prices.find((row) => row.id === drink.id)?.priceCents ?? null });
              setSuccess(null);
            }}
            style={({ pressed }) => [styles.option, draft.drinkId === drink.id && styles.selected, pressed && styles.pressed]}>
            <Text style={styles.label}>{drink.name}</Text>
            <Text style={styles.hint}>{drink.category} · {drink.serving_ml} ml</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>EUR price (€)</Text>
      <TextInput
        accessibilityLabel="Drink price in euros"
        accessibilityHint="Use a decimal point or comma, with up to two decimal places"
        value={draft.euros}
        onChangeText={(euros) => { dispatchDraft({ type: 'price', euros }); setSuccess(null); }}
        editable={!disabled}
        placeholder="e.g. 6.50 or 6,50"
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.purpleLight}
        keyboardType="decimal-pad"
        keyboardAppearance="dark"
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        maxLength={16}
        style={styles.input}
      />
      <Text style={styles.hint}>€0.50–€100 · Up to two decimals. Serving size comes from the catalog.</Text>
      {draft.euros.trim().length > 0 && !price.ok && <Text accessibilityLiveRegion="polite" style={styles.error}>{price.error}</Text>}
      {success && <Text accessibilityLiveRegion="polite" style={styles.success}>{success}</Text>}
      <Text style={styles.hint}>Community-reported, not verified. Corrections save a new observation and keep previous prices in session history.</Text>
      <View style={styles.actions}>
        <PrimaryButton label="Cancel" variant="secondary" disabled={disabled} onPress={cancel} style={styles.button} />
        <PrimaryButton label="Submit price" disabled={!selected || !price.ok || disabled} onPress={submit} style={styles.button} />
      </View>
    </View>
  );
}
