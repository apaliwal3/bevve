import { OptionalContributionCard } from './optional-contribution-card';
import { useEffect } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import type { AccountCatalogValue } from '@/features/catalog/catalog-provider';
import { useTranslation } from '@/localization/language-provider';
import type { PlainTranslationKey } from '@/localization/translation';
import { useAccountSafety } from './account-safety-provider';
import { emptyIncidentOperation, emptyIncidentReview, emptySafetyPublicState } from './account-safety-store';
import { emptyIncidentDraft } from './extra-form-drafts';
import { SafetyInformationForm } from './safety-information-form';
import { inlineFormStyles as formStyles } from './inline-form-styles';

const categoryKeys: Record<string, PlainTranslationKey> = { Theft: 'Theft', Harassment: 'Harassment', Violence: 'Violence', Other: 'Other' };
export function AccountPublishedSafety({ barId }: { barId: string }) {
  const state = useAccountSafety(), { t, format } = useTranslation();
  const { refreshPublic } = state;
  useEffect(() => { void refreshPublic(barId); }, [barId, refreshPublic]);
  const data = state.publicByVenue[barId] ?? emptySafetyPublicState;
  return <View style={styles.section}>
    {data.status === 'loading' && <Text style={styles.note}>{t('Loading published safety summaries…')}</Text>}
    {data.error && <Text accessibilityRole="alert" style={styles.note}>{data.status === 'ready'
      ? t('Could not refresh safety summaries. Showing the last loaded information.') : t('Published safety summaries could not be loaded.')}</Text>}
    {data.status === 'ready' && data.rows.length === 0 && <Text style={styles.note}>{t('No published safety information.')}</Text>}
    {[...data.rows].sort((a, b) => b.published_at.localeCompare(a.published_at) || b.id.localeCompare(a.id)).map(row => <View key={row.id} style={styles.card}>
      <Text style={styles.note}>{t('Moderator-reviewed · Published {date}', { date: format.dateTime(row.published_at) })}</Text>
      <Text style={styles.description}>{row.summary}</Text>
    </View>)}
    <Text style={styles.note}>{t('Moderator review is not independent verification.')}</Text>
    <PrimaryButton label={data.error ? t('Retry safety summaries') : t('Refresh safety summaries')} variant="secondary" disabled={data.refreshing} onPress={() => { void refreshPublic(barId); }} />
  </View>;
}
export function AccountIncidentFeedback() {
  const state = useAccountSafety(), { t } = useTranslation();
  if (state.status === 'ready' && !state.error) return null;
  return <View style={styles.section}>
    <Text accessibilityRole={state.error ? 'alert' : undefined} style={styles.note}>{state.error
      ? t('Your private reports could not be refreshed. Drafts and unconfirmed submissions are kept for retry.') : t('Loading your private reports…')}</Text>
    {state.error && <PrimaryButton label={t('Retry private reports')} variant="secondary" disabled={state.refreshing} onPress={() => { void state.refresh(); }} />}
  </View>;
}
export function AccountIncidentPanel({ catalog, barId }: { catalog: AccountCatalogValue; barId: string }) {
  const state = useAccountSafety();
  const op = state.operations[barId] ?? emptyIncidentOperation;
  if (!catalog.venues.some(row => row.id === barId)) return null;
  return <View style={styles.section}>
    <OptionalContributionCard titleKey="Safety information" hintKey="Public information and private reports" icon="safety" disabled={op.saving}>
      <AccountIncidentFeedback />
      <SafetyInformationForm demoNotes={[]} draft={state.drafts[barId] ?? emptyIncidentDraft}
        onDraftAction={action => state.updateDraft(barId, action, op.version)} submitUnavailable={state.status !== 'ready'}
        publishedContent={<AccountPublishedSafety barId={barId} />}
        feedback={{ pending: Boolean(op.request), saving: op.saving, error: op.error, saved: op.saved,
          retry: () => { if (op.request) return state.retry(barId, op.request.id); } }}
        onSubmit={() => state.submit(barId, op.version)} onCancel={() => {}} />
    </OptionalContributionCard>
  </View>;
}
export function AccountIncidentHistory({ catalog }: { catalog: AccountCatalogValue }) {
  const state = useAccountSafety(), { t, format } = useTranslation();
  const statuses = { pending: t('Pending'), approved: t('Approved'), rejected: t('Rejected') };
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.title}>{t('My private incident reports')}</Text>
    <Text style={styles.note}>{t('Visible only to you and moderators. These reports do not enter your public activity counts or rankings.')}</Text>
    <AccountIncidentFeedback />
    {state.status === 'ready' && state.history.length === 0 && <Text style={styles.note}>{t('No private reports submitted yet.')}</Text>}
    {[...state.history].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).map(row => <View key={row.id} style={styles.card}>
      <Text style={styles.title}>{catalog.venues.find(venue => venue.id === row.bar_id)?.name ?? t('Venue unavailable')}</Text>
      <Text style={styles.note}>{Object.hasOwn(categoryKeys, row.category) ? t(categoryKeys[row.category]) : row.category}</Text>
      <Text style={styles.note}>{t('{status} · Submitted {date}', { status: statuses[row.status], date: format.dateTime(row.created_at) })}</Text>
      {row.occurred_at && <Text style={styles.note}>{t('Incident date: {date}', { date: format.dateTime(row.occurred_at) })}</Text>}
      {row.reviewed_at && <Text style={styles.note}>{t('Reviewed {date}', { date: format.dateTime(row.reviewed_at) })}</Text>}
      <Text style={styles.description}>{row.description}</Text>
    </View>)}
  </View>;
}
export function AccountIncidentModeration({ catalog }: { catalog: AccountCatalogValue }) {
  const state = useAccountSafety(), { t, format } = useTranslation();
  if (state.queueStatus === 'loading') return null;
  if (state.queueError) return <View style={styles.section}>
    <Text accessibilityRole="alert" style={styles.note}>{t('Incident review access could not be checked.')}</Text>
    <PrimaryButton label={t('Retry incident review access')} variant="secondary" disabled={state.queueRefreshing} onPress={() => { void state.refreshQueue(); }} />
  </View>;
  if (!state.isModerator) return null;
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.title}>{t('Private incident review queue')}</Text>
    <Text style={styles.note}>{t('Write a separate public summary without names, contact details or other identifying information. Private descriptions and reporter identities are never copied automatically.')}</Text>
    {state.queue.length === 0 && <Text style={styles.note}>{t('No private reports awaiting review.')}</Text>}
    {state.queue.map(row => {
      const op = state.reviews[row.id] ?? emptyIncidentReview, locked = Boolean(op.request);
      return <View key={row.id} style={styles.card}>
        <Text style={styles.title}>{catalog.venues.find(venue => venue.id === row.bar_id)?.name ?? t('Venue unavailable')}</Text>
        <Text style={styles.note}>{Object.hasOwn(categoryKeys, row.category) ? t(categoryKeys[row.category]) : row.category}</Text>
        <Text style={styles.note}>{t('Submitted {date}', { date: format.dateTime(row.created_at) })}</Text>
        {row.occurred_at && <Text style={styles.note}>{t('Incident date: {date}', { date: format.dateTime(row.occurred_at) })}</Text>}
        <Text style={styles.note}>{t('Private description · Do not publish verbatim')}</Text>
        <Text style={styles.description}>{row.description}</Text>
        <TextInput accessibilityLabel={t('Public safety summary')} value={op.draft} editable={!locked} multiline maxLength={1000}
          placeholder={t('Write a public summary…')} placeholderTextColor={theme.colors.textMuted} keyboardAppearance="dark"
          selectionColor={theme.colors.purpleLight} onChangeText={value => state.updateReviewDraft(row.id, value)} style={[formStyles.input, formStyles.multiline]} />
        {op.error && <Text accessibilityRole="alert" style={styles.note}>{t('The incident review could not be confirmed. Retry the same decision and summary.')}</Text>}
        {op.request ? <PrimaryButton label={op.saving ? t('Please wait…') : op.request.decision === 'approved' ? t('Retry approval') : t('Retry rejection')} disabled={op.saving}
          onPress={() => { if (op.request) void state.moderate(row.id, op.request.decision).catch(() => {}); }} /> : <>
          <PrimaryButton label={t('Approve and publish summary')} disabled={!op.draft.trim() || op.draft.trim().length > 1000}
            onPress={() => { void state.moderate(row.id, 'approved').catch(() => {}); }} />
          <PrimaryButton label={t('Reject private report')} variant="secondary" onPress={() => { void state.moderate(row.id, 'rejected').catch(() => {}); }} />
        </>}
      </View>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: theme.spacing.md }, card: { gap: theme.spacing.sm, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.card },
  title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 17 },
  description: { color: theme.colors.text, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 22 },
  note: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 19 },
});
