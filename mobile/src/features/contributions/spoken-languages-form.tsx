import { useTranslation } from '@/localization/language-provider';
import { useReducer, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { languageCatalog, type VenueLanguageCode } from '@/fixtures/contribution-catalog';
import { venueLanguageLabel } from '@/localization/venue-copy';
import type { VenueDetails } from '@/types/venue';

import { languageDraftReducer } from './extra-form-drafts';
import { inlineFormStyles as styles } from './inline-form-styles';
import type { SessionLanguageSuggestion } from './venue-extras-state';

type SpokenLanguagesFormProps = {
  languages: VenueDetails['languages'];
  pending: readonly SessionLanguageSuggestion[];
  disabled?: boolean;
  onSubmit: (code: typeof languageCatalog[number]['code']) => void;
  onCancel: () => void;
};

export function SpokenLanguagesForm({ languages, pending, disabled = false, onSubmit, onCancel }: SpokenLanguagesFormProps) {
  const { t } = useTranslation();
  const [draft, dispatchDraft] = useReducer(languageDraftReducer, null);
  const [success, setSuccess] = useState<VenueLanguageCode | null>(null);
  const options = languageCatalog.filter((language) => !languages.some((associated) => associated.code === language.code) &&
    !pending.some((suggestion) => suggestion.language_code === language.code));
  const canSubmit = draft !== null && options.some((language) => language.code === draft);

  function cancel() {
    dispatchDraft({ type: 'reset' });
    setSuccess(null);
    onCancel();
  }

  function submit() {
    if (!draft || !canSubmit || disabled) return;
    onSubmit(draft);
    setSuccess(draft);
    dispatchDraft({ type: 'reset' });
  }

  return (
    <View style={styles.form}>
      <View style={styles.info}>
        <Text style={styles.label}>{t("Currently associated · Demo data")}</Text>
        <View style={styles.options}>
          {languages.map((language) => <Text key={language.code} style={styles.tag}>{venueLanguageLabel(language.code, t, language.name)}</Text>)}
        </View>
        {languages.length === 0 && <Text style={styles.hint}>{t("No languages associated yet.")}</Text>}
      </View>
      {pending.length > 0 && (
        <View style={styles.form}>
          <Text style={styles.label}>{t("Suggestions awaiting review")}</Text>
          <View style={styles.options}>
            {pending.map((suggestion) => <Text key={suggestion.id} style={styles.tag}>{venueLanguageLabel(suggestion.language_code, t)} · {t('Pending')}</Text>)}
          </View>
        </View>
      )}
      <Text style={styles.label}>{t("Suggest another language")}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t("Suggested venue language")} style={styles.options}>
        {options.map((language) => (
          <Pressable
            key={language.code}
            accessibilityRole="radio"
            accessibilityState={{ checked: draft === language.code, disabled }}
            disabled={disabled}
            onPress={() => { dispatchDraft({ type: 'select', code: language.code }); setSuccess(null); }}
            style={({ pressed }) => [styles.option, draft === language.code && styles.selected, pressed && styles.pressed]}>
            <Text style={styles.label}>{venueLanguageLabel(language.code, t)}</Text>
          </Pressable>
        ))}
      </View>
      {options.length === 0 && <Text style={styles.hint}>{t("All catalog languages are already associated or pending.")}</Text>}
      <Text style={styles.hint}>{t("Suggestions remain Pending until reviewed. This does not change the app’s interface language.")}</Text>
      {success && <Text accessibilityLiveRegion="polite" style={styles.success}>{t('{language} suggestion saved in demo only — Pending.', { language: venueLanguageLabel(success, t) })}</Text>}
      <View style={styles.actions}>
        <PrimaryButton label={t("Cancel")} variant="secondary" disabled={disabled} onPress={cancel} style={styles.button} />
        <PrimaryButton label={t("Suggest language")} disabled={!canSubmit || disabled} onPress={submit} style={styles.button} />
      </View>
    </View>
  );
}
