import { useBatchedContribution } from './contribution-batch';
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
import type { ContributionFormFeedback } from './contribution-form-feedback';

type SpokenLanguagesFormProps = {
  languages: VenueDetails['languages'];
  pending: readonly Pick<SessionLanguageSuggestion, 'id' | 'language_code'>[];
  disabled?: boolean;
  onSubmit: (code: typeof languageCatalog[number]['code']) => void | Promise<void>;
  onCancel: () => void;
  feedback?: ContributionFormFeedback;
  initialCode?: VenueLanguageCode;
};

export function SpokenLanguagesForm({ languages, pending, disabled: parentDisabled = false, onSubmit, onCancel, feedback, initialCode }: SpokenLanguagesFormProps) {
  const { t } = useTranslation();
  const [draft, dispatchDraft] = useReducer(languageDraftReducer, initialCode ?? null);
  const [success, setSuccess] = useState<VenueLanguageCode | null>(null);
  const options = languageCatalog.filter((language) => !languages.some((associated) => associated.code === language.code) &&
    !pending.some((suggestion) => suggestion.language_code === language.code));
  const canSubmit = draft !== null && options.some((language) => language.code === draft);

  const batch = useBatchedContribution('languages', draft, canSubmit, () => { if (draft && canSubmit) return onSubmit(draft); }, feedback);
  const disabled = parentDisabled || batch.saving || Boolean(feedback?.pending);

  function cancel() {
    dispatchDraft({ type: 'reset' });
    setSuccess(null);
    onCancel();
  }

  function submit() {
    if (!draft || !canSubmit || disabled) return;
    onSubmit(draft);
    setSuccess(draft);
    if (!feedback) dispatchDraft({ type: 'reset' });
  }

  return (
    <View style={styles.form}>
      <View style={styles.info}>
        <Text style={styles.label}>{feedback ? t('Currently associated') : t("Currently associated · Demo data")}</Text>
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
            <Text style={[styles.label, draft === language.code && styles.selectedLabel]}>{venueLanguageLabel(language.code, t)}</Text>
          </Pressable>
        ))}
      </View>
      {options.length === 0 && <Text style={styles.hint}>{t("All catalog languages are already associated or pending.")}</Text>}
      <Text style={styles.hint}>{t("Suggestions remain Pending until reviewed. This does not change the app’s interface language.")}</Text>
      {success && (!feedback || feedback.saved) && <Text accessibilityLiveRegion="polite" style={styles.success}>{feedback
        ? t('Language suggestion saved to your account. Check its review status in Profile.')
        : t('{language} suggestion saved in demo only — Pending.', { language: venueLanguageLabel(success, t) })}</Text>}
      {feedback?.pending && <Text style={styles.hint}>{t('Unconfirmed suggestion: {language}', { language: venueLanguageLabel(initialCode ?? draft ?? '', t) })}</Text>}
      {feedback?.saving && <Text accessibilityLiveRegion="polite" style={styles.hint}>{t('Saving contribution…')}</Text>}
      {feedback?.error && <Text accessibilityRole="alert" style={styles.hint}>{t('Your contribution could not be confirmed. Retry to save the same details without duplicates.')}</Text>}
      {!batch.batched && <View style={styles.actions}>
        <PrimaryButton label={t("Cancel")} variant="secondary" disabled={disabled} onPress={cancel} style={styles.button} />
        <PrimaryButton label={feedback?.pending ? t('Retry save') : t("Suggest language")} disabled={parentDisabled || feedback?.saving || (!canSubmit && !feedback?.pending)} onPress={feedback?.pending ? feedback.retry : submit} style={styles.button} />
      </View>}
    </View>
  );
}
