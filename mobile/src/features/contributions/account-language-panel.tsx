import { OptionalContributionCard } from './optional-contribution-card';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import type { AccountCatalogValue } from '@/features/catalog/catalog-provider';
import { ProfileActivityRow, ProfileActivitySection } from '@/features/profile/profile-activity-components';
import { catalogVenue } from '@/features/catalog/catalog-adapters';
import { parseUuid, type UUID } from '@/features/comparisons/comparison-state';
import { useTranslation } from '@/localization/language-provider';
import { venueLanguageLabel } from '@/localization/venue-copy';
import { useAccountLanguages } from './account-languages-provider';
import { emptyLanguageOperation } from './account-language-store';
import { SpokenLanguagesForm } from './spoken-languages-form';

export function AccountLanguageFeedback() {
  const state = useAccountLanguages(), { t } = useTranslation();
  if (state.status === 'ready' && !state.error) return null;
  return <View style={styles.section}>
    <Text accessibilityRole={state.error ? 'alert' : undefined} style={styles.note}>{state.error
      ? t('Language suggestions could not be refreshed. Your saved details are kept for retry.') : t('Loading language suggestions…')}</Text>
    {state.error && <PrimaryButton label={t('Retry language suggestions')} disabled={state.refreshing} variant="secondary" onPress={() => { void state.refresh(); }} />}
  </View>;
}
export function AccountLanguagePanel({ catalog, barId }: { catalog: AccountCatalogValue; barId: string }) {
  const state = useAccountLanguages(), { t } = useTranslation();
  const venue = catalog.venues.find(row => row.id === barId);
  const op = state.operations[barId] ?? emptyLanguageOperation;
  if (!venue || !catalog.impressions[barId]) return null;
  return <View style={styles.section}>
    <OptionalContributionCard titleKey="Spoken languages" hintKey="Languages spoken by staff" icon="languages" disabled={op.saving}>
      <AccountLanguageFeedback />
      {state.status === 'ready' && <SpokenLanguagesForm languages={venue.languages.map(row => ({ ...row, name: venueLanguageLabel(row.code, t) }))}
        pending={state.history.filter(row => row.bar_id === barId && row.status === 'pending')}
        initialCodes={op.remainingCodes ?? (op.request ? [op.request.code] : [])}
        feedback={{ pending: Boolean(op.request || op.remainingCodes?.length), saving: op.saving, error: op.error, saved: op.saved,
          retry: () => state.retryMany(barId) }}
        onSubmit={codes => state.submitMany(barId, codes, op.version)} onCancel={() => {}} />}
    </OptionalContributionCard>
  </View>;
}
export function AccountVenueLanguages({ barId, languages }: { barId: string; languages: readonly { code: string }[] }) {
  const state = useAccountLanguages(), { t } = useTranslation();
  const associated = new Set(languages.map(language => language.code));
  const submitted = [...new Set(state.history.filter(row => row.bar_id === barId && row.status !== 'rejected' &&
    !associated.has(row.language_code)).map(row => row.language_code))];
  return <View style={styles.section}>
    <View style={styles.tags}>
      {languages.map(language => <Text key={language.code} style={styles.tag}>{venueLanguageLabel(language.code, t)}</Text>)}
      {submitted.map(code => <Text key={code} style={styles.tag}>{venueLanguageLabel(code, t)} · {t('Not verified')}</Text>)}
    </View>
    {languages.length === 0 && submitted.length === 0 && state.status === 'ready' && <Text style={styles.note}>{t('No languages reported yet.')}</Text>}
    <AccountLanguageFeedback />
  </View>;
}
export function AccountLanguageHistory({ catalog, onOpenVenue }: { catalog: AccountCatalogValue; onOpenVenue: (id: UUID) => void }) {
  const state = useAccountLanguages(), { t, format } = useTranslation();
  const statuses = { pending: t('Pending'), approved: t('Approved'), rejected: t('Rejected') };
  return <View style={styles.section}>
    <AccountLanguageFeedback />
    {state.status === 'ready' && <ProfileActivitySection title={t('My language suggestions')} count={state.history.length} icon="languages"
      hint={t('Only approved suggestions can add a venue language. The app interface stays in English.')} emptyHint={t('Suggest a spoken language from a venue’s + overlay.')}>
      {[...state.history].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).map(row => {
        const venue = catalog.venues.find(item => item.id === row.bar_id), id = parseUuid(row.bar_id)!;
        const display = venue ? { ...catalogVenue(venue), id, available: true } : { id, name: t('Venue unavailable'), area: t('Neighborhood unavailable'), image: null, available: false };
        return <ProfileActivityRow key={row.id} venue={display} onPress={() => onOpenVenue(id)}
          summary={t('{language} · {status} · {date}', { language: venueLanguageLabel(row.language_code, t), status: statuses[row.status], date: format.dateTime(row.created_at) })} />;
      })}
    </ProfileActivitySection>}
  </View>;
}
export function AccountLanguageModeration({ catalog }: { catalog: AccountCatalogValue }) {
  const state = useAccountLanguages(), { t } = useTranslation();
  if (state.queueStatus === 'loading') return null;
  if (state.queueError) return <View style={styles.section}>
    <Text accessibilityRole="alert" style={styles.note}>{t('Language review access could not be checked.')}</Text>
    <PrimaryButton label={t('Retry language review access')} variant="secondary" disabled={state.queueRefreshing} onPress={() => { void state.refreshQueue(); }} />
  </View>;
  if (!state.isModerator) return null;
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.title}>{t('Language review queue')}</Text>
    <Text style={styles.note}>{t('Approval adds only the suggested language to the venue. Rejection keeps it out of the public catalog.')}</Text>
    {state.queue.length === 0 && <Text style={styles.note}>{t('No language suggestions awaiting review.')}</Text>}
    {state.queue.map(row => {
      const op = state.reviews[row.id];
      return <View key={row.id} style={styles.card}>
        <Text style={styles.title}>{catalog.venues.find(venue => venue.id === row.bar_id)?.name ?? t('Venue unavailable')}</Text>
        <Text style={styles.note}>{venueLanguageLabel(row.language_code, t)}</Text>
        {op?.error && <Text accessibilityRole="alert" style={styles.note}>{t('The review could not be confirmed. Retry the same decision.')}</Text>}
        {op ? <PrimaryButton label={op.saving ? t('Please wait…') : op.decision === 'approved' ? t('Retry approval') : t('Retry rejection')} disabled={op.saving}
          onPress={() => { void state.moderate(row.id, op.decision).catch(() => {}); }} /> : <>
          <PrimaryButton label={t('Approve language')} onPress={() => { void state.moderate(row.id, 'approved').catch(() => {}); }} />
          <PrimaryButton label={t('Reject language')} variant="secondary" onPress={() => { void state.moderate(row.id, 'rejected').catch(() => {}); }} />
        </>}
      </View>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  tag: { color: theme.colors.purpleText, fontFamily: theme.fonts.bodyBold, fontSize: 10, paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs, borderRadius: theme.radii.sm, backgroundColor: theme.colors.purpleTint },
  section: { gap: theme.spacing.md }, card: { gap: theme.spacing.sm, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.card },
  title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 17 },
  note: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 19 },
});
