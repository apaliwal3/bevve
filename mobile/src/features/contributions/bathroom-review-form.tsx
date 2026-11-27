import { useBatchedContribution } from './contribution-batch';
import { useTranslation } from '@/localization/language-provider';
import { useReducer, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { StarSelector } from '@/features/ratings/star-selector';
import type { PlainTranslationKey } from '@/localization/translation';

import { bathroomDraftFromSaved, bathroomDraftReducer, completeBathroomDraft, type BathroomDraft } from './contribution-drafts';
import type { BathroomScores } from './contribution-state';
import type { ContributionFormFeedback } from './contribution-form-feedback';

const categories: { key: keyof BathroomScores; label: PlainTranslationKey; hint: PlainTranslationKey }[] = [
  { key: 'cleanliness', label: 'Cleanliness', hint: 'Condition and supplies' },
  { key: 'accessibility', label: 'Accessibility', hint: 'Entry and usable space' },
  { key: 'wait_time', label: 'Waiting time', hint: '5 means a better, shorter wait' },
];

type BathroomReviewFormProps = {
  savedReview: BathroomDraft | null;
  disabled?: boolean;
  onSubmit: (scores: BathroomScores) => void | Promise<void>;
  onCancel: () => void;
  feedback?: ContributionFormFeedback;
  initialScores?: BathroomScores;
};

export function BathroomReviewForm({ savedReview, disabled: parentDisabled = false, onSubmit, onCancel, feedback, initialScores }: BathroomReviewFormProps) {
  const { t } = useTranslation();
  const [draft, dispatchDraft] = useReducer(bathroomDraftReducer, bathroomDraftFromSaved(initialScores ?? savedReview));
  const [success, setSuccess] = useState(false);

  const batch = useBatchedContribution('bathrooms', draft, completeBathroomDraft(draft), () => { if (completeBathroomDraft(draft)) return onSubmit(draft); }, feedback);
  const disabled = parentDisabled || batch.saving || Boolean(feedback?.pending);

  function cancel() {
    dispatchDraft({ type: 'cancel', saved: savedReview });
    setSuccess(false);
    onCancel();
  }

  function submit() {
    if (!completeBathroomDraft(draft) || disabled) return;
    onSubmit(draft);
    setSuccess(true);
  }

  return (
    <View style={styles.form}>
      {categories.map((category) => (
        <View key={category.key} style={styles.category}>
          <Text style={styles.label}>{t(category.label)}</Text>
          <Text style={styles.hint}>{t(category.hint)}</Text>
          <StarSelector
            label={t('{category} rating', { category: t(category.label) })}
            value={draft[category.key]}
            disabled={disabled}
            onChange={(rating) => { dispatchDraft({ type: 'rate', category: category.key, rating }); setSuccess(false); }}
          />
        </View>
      ))}
      <Text style={styles.hint}>{t("All three ratings are required. Editing replaces your saved bathroom review.")}</Text>
      {success && (!feedback || feedback.saved) && <Text accessibilityLiveRegion="polite" style={styles.success}>{feedback ? t('Bathroom ratings saved to your account.') : t("Bathroom ratings saved for this session.")}</Text>}
      {feedback?.saving && <Text accessibilityLiveRegion="polite" style={styles.hint}>{t('Saving contribution…')}</Text>}
      {feedback?.error && <Text accessibilityRole="alert" style={styles.hint}>{t('Your contribution could not be confirmed. Retry to save the same details without duplicates.')}</Text>}
      {!batch.batched && <View style={styles.actions}>
        <PrimaryButton label={t("Cancel")} variant="secondary" disabled={disabled} onPress={cancel} style={styles.button} />
        <PrimaryButton label={feedback?.pending ? t('Retry save') : t("Submit ratings")} disabled={parentDisabled || feedback?.saving || (!completeBathroomDraft(draft) && !feedback?.pending)} onPress={feedback?.pending ? feedback.retry : submit} style={styles.button} />
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: theme.spacing.lg
  },
  category: {
    gap: theme.spacing.sm
  },
  label: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13
  },
  hint: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 18
  },
  success: {
    color: theme.colors.success,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    lineHeight: 19
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  button: {
    flexGrow: 1,
    flexBasis: 100
  }
});
