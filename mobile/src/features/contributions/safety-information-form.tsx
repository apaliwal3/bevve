import { useTranslation } from '@/localization/language-provider';
import { useReducer, useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { contributionError } from '@/localization/venue-copy';

import { emptyIncidentDraft, incidentDraftReducer, incidentSubmission, type IncidentSubmission } from './extra-form-drafts';
import { inlineFormStyles as styles } from './inline-form-styles';
import { incidentCategories } from './venue-extras-state';

type SafetyInformationFormProps = {
  demoNotes: readonly string[];
  disabled?: boolean;
  onSubmit: (incident: IncidentSubmission) => void;
  onCancel: () => void;
};

export function SafetyInformationForm({ demoNotes, disabled = false, onSubmit, onCancel }: SafetyInformationFormProps) {
  const { t, format } = useTranslation();
  const [draft, dispatchDraft] = useReducer(incidentDraftReducer, emptyIncidentDraft);
  const [success, setSuccess] = useState(false);
  const validation = incidentSubmission(draft);
  const hasDraft = draft.category !== null || draft.description.length > 0 || draft.date.length > 0;

  function cancel() {
    dispatchDraft({ type: 'reset' });
    setSuccess(false);
    Keyboard.dismiss();
    onCancel();
  }

  function submit() {
    const current = incidentSubmission(draft);
    if (!current.ok || disabled) return;
    onSubmit(current.value);
    dispatchDraft({ type: 'reset' });
    setSuccess(true);
    Keyboard.dismiss();
  }

  return (
    <View style={styles.form}>
      <View style={styles.info}>
        <Text style={styles.eyebrow}>{t("DEMO DATA")}</Text>
        <Text style={styles.label}>{t("Approved demonstration information")}</Text>
        {demoNotes.map((note, index) => <Text key={index} style={styles.hint}>{note}</Text>)}
        {demoNotes.length === 0 && <Text style={styles.hint}>{t("No approved demo information available.")}</Text>}
        <Text style={styles.hint}>{t("This preview contains no real verified public records. Missing information does not guarantee safety.")}</Text>
      </View>
      <Text style={styles.label}>{t("Optional private incident report")}</Text>
      <Text style={styles.hint}>{t("Demo session only. Your report stays private and pending moderation; it is not published or sent to a real database.")}</Text>
      <Text style={styles.label}>{t("Category · Required")}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t("Incident category")} style={styles.options}>
        {incidentCategories.map((category) => (
          <Pressable
            key={category}
            accessibilityRole="radio"
            accessibilityState={{ checked: draft.category === category, disabled }}
            disabled={disabled}
            onPress={() => { dispatchDraft({ type: 'category', category }); setSuccess(false); }}
            style={({ pressed }) => [styles.option, draft.category === category && styles.selected, pressed && styles.pressed]}>
            <Text style={styles.label}>{t(category)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{t("Incident date · Optional")}</Text>
      <TextInput
        accessibilityLabel={t("Incident date, optional, YYYY-MM-DD")}
        value={draft.date}
        onChangeText={(date) => { dispatchDraft({ type: 'date', date }); setSuccess(false); }}
        editable={!disabled}
        placeholder={t("YYYY-MM-DD")}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.purpleLight}
        keyboardType="numbers-and-punctuation"
        keyboardAppearance="dark"
        autoCorrect={false}
        maxLength={10}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        style={styles.input}
      />
      <Text style={styles.label}>{t("Description · Required")}</Text>
      <TextInput
        accessibilityLabel={t("Private incident description")}
        value={draft.description}
        onChangeText={(description) => { dispatchDraft({ type: 'description', description }); setSuccess(false); }}
        editable={!disabled}
        placeholder={t("Describe what happened…")}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.purpleLight}
        keyboardAppearance="dark"
        multiline
        maxLength={4000}
        style={[styles.input, styles.multiline]}
      />
      <Text style={styles.hint}>{t('{count}/{limit} characters', { count: draft.description.length, limit: format.number(4000) })}</Text>
      {hasDraft && !validation.ok && <Text accessibilityLiveRegion="polite" style={styles.error}>{contributionError(validation.error, t, format.currency)}</Text>}
      {success && <Text accessibilityLiveRegion="polite" style={styles.success}>{t("Saved in demo only — pending moderation")}</Text>}
      <View style={styles.actions}>
        <PrimaryButton label={t("Cancel")} variant="secondary" disabled={disabled} onPress={cancel} style={styles.button} />
        <PrimaryButton label={t("Submit report")} disabled={!validation.ok || disabled} onPress={submit} style={styles.button} />
      </View>
    </View>
  );
}
