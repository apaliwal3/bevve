import { useReducer, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { StarSelector } from '@/features/ratings/star-selector';

import { bathroomDraftFromSaved, bathroomDraftReducer, completeBathroomDraft } from './contribution-drafts';
import type { BathroomScores, SessionBathroomReview } from './contribution-state';

const categories: { key: keyof BathroomScores; label: string; hint: string }[] = [
  { key: 'cleanliness', label: 'Cleanliness', hint: 'Condition and supplies' },
  { key: 'accessibility', label: 'Accessibility', hint: 'Entry and usable space' },
  { key: 'wait_time', label: 'Waiting time', hint: '5 means a better, shorter wait' },
];

type BathroomReviewFormProps = {
  savedReview: SessionBathroomReview | null;
  disabled?: boolean;
  onSubmit: (scores: BathroomScores) => void;
  onCancel: () => void;
};

export function BathroomReviewForm({ savedReview, disabled = false, onSubmit, onCancel }: BathroomReviewFormProps) {
  const [draft, dispatchDraft] = useReducer(bathroomDraftReducer, bathroomDraftFromSaved(savedReview));
  const [success, setSuccess] = useState(false);

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
          <Text style={styles.label}>{category.label}</Text>
          <Text style={styles.hint}>{category.hint}</Text>
          <StarSelector
            label={`${category.label} rating`}
            value={draft[category.key]}
            disabled={disabled}
            onChange={(rating) => { dispatchDraft({ type: 'rate', category: category.key, rating }); setSuccess(false); }}
          />
        </View>
      ))}
      <Text style={styles.hint}>All three ratings are required. Editing replaces your saved bathroom review.</Text>
      {success && <Text accessibilityLiveRegion="polite" style={styles.success}>Bathroom ratings saved for this session.</Text>}
      <View style={styles.actions}>
        <PrimaryButton label="Cancel" variant="secondary" disabled={disabled} onPress={cancel} style={styles.button} />
        <PrimaryButton label="Submit ratings" disabled={!completeBathroomDraft(draft) || disabled} onPress={submit} style={styles.button} />
      </View>
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
