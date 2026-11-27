import { useBatchedContribution } from './contribution-batch';
import { useTranslation } from '@/localization/language-provider';
import { useReducer, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { crowdLevelKeys } from '@/localization/venue-copy';

import { crowdDraftReducer } from './contribution-drafts';
import type { CrowdLevel, SessionCrowdReport } from './contribution-state';
import type { ContributionFormFeedback } from './contribution-form-feedback';

const options: { level: CrowdLevel }[] = [
  { level: 1 },
  { level: 2 },
  { level: 3 },
  { level: 4 },
  { level: 5 },
];

type CrowdReportFormProps = {
  savedReport: SessionCrowdReport | null;
  disabled?: boolean;
  onSubmit: (level: CrowdLevel) => void | Promise<void>;
  onCancel: () => void;
  feedback?: ContributionFormFeedback;
  initialLevel?: CrowdLevel;
};

export function CrowdReportForm({ savedReport, disabled: parentDisabled = false, onSubmit, onCancel, feedback, initialLevel }: CrowdReportFormProps) {
  const { t, format } = useTranslation();
  const [level, dispatchDraft] = useReducer(crowdDraftReducer, initialLevel ?? savedReport?.level ?? null);
  const [success, setSuccess] = useState(false);

  const batch = useBatchedContribution('crowd', level, level !== null, () => { if (level !== null) return onSubmit(level); }, feedback);
  const disabled = parentDisabled || batch.saving || Boolean(feedback?.pending);

  function cancel() {
    dispatchDraft({ type: 'cancel', saved: savedReport?.level ?? null });
    setSuccess(false);
    onCancel();
  }

  function submit() {
    if (level === null || disabled) return;
    onSubmit(level);
    setSuccess(true);
  }

  return (
    <View style={styles.form}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t("Crowd level")} style={styles.options}>
        {options.map((option) => (
          <Pressable
            key={option.level}
            accessibilityRole="radio"
            accessibilityLabel={option.level + ' ' + t(crowdLevelKeys[option.level])}
            accessibilityState={{ checked: level === option.level, disabled }}
            disabled={disabled}
            onPress={() => { dispatchDraft({ type: 'select', level: option.level }); setSuccess(false); }}
            style={({ pressed }) => [styles.option, level === option.level && styles.selected, pressed && styles.pressed]}>
            <Text style={[styles.level, level === option.level && styles.selectedLabel]}>{option.level}</Text>
            <Text style={[styles.optionLabel, level === option.level && styles.selectedLabel]}>{t(crowdLevelKeys[option.level])}</Text>
          </Pressable>
        ))}
      </View>
      {savedReport && <Text style={styles.hint}>{t('Last saved: {date}', { date: format.dateTime(savedReport.created_at) })}</Text>}
      {success && (!feedback || feedback.saved) && <Text accessibilityLiveRegion="polite" style={styles.success}>{feedback ? t('Crowd report saved to your account.') : t("Crowd report saved for this session.")}</Text>}
      {feedback?.saving && <Text accessibilityLiveRegion="polite" style={styles.hint}>{t('Saving contribution…')}</Text>}
      {feedback?.error && <Text accessibilityRole="alert" style={styles.hint}>{t('Your contribution could not be confirmed. Retry to save the same details without duplicates.')}</Text>}
      <Text style={styles.hint}>{t("Only your latest report counts. A crowd classification needs at least 3 recent contributors.")}</Text>
      {!batch.batched && <View style={styles.actions}>
        <PrimaryButton label={t("Cancel")} variant="secondary" disabled={disabled} onPress={cancel} style={styles.button} />
        <PrimaryButton label={feedback?.pending ? t('Retry save') : t("Submit crowd")} disabled={parentDisabled || feedback?.saving || (level === null && !feedback?.pending)} onPress={feedback?.pending ? feedback.retry : submit} style={styles.button} />
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: theme.spacing.md
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.control
  },
  selected: {
    borderColor: theme.colors.accentBorder,
    backgroundColor: theme.colors.purpleButton
  },
  selectedLabel: { color: theme.colors.onAccent },
  level: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 16
  },
  optionLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12
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
  },
  pressed: {
    opacity: 0.7
  }
});
