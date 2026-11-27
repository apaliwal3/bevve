import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/app-icon';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { parseUuid, type UUID } from '@/features/comparisons/comparison-state';
import { ProfileActivityRow } from '@/features/profile/profile-activity-components';
import { useTranslation } from '@/localization/language-provider';
import type { Venue } from '@/types/venue';
import { BookmarkButton } from './bookmark-button';
import { useSavedBars } from './saved-bars-provider';

export function SavedBarsSection({ venues, onOpenVenue }: { venues: readonly Venue[]; onOpenVenue: (id: UUID) => void }) {
  const state = useSavedBars(), { t, format } = useTranslation();
  const rows = Object.values(state.bars).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.bar_id.localeCompare(b.bar_id));
  return <View style={styles.section}>
    <View style={styles.heading}><AppIcon name="bookmark" size={20} color={theme.colors.purpleLight} /><Text accessibilityRole="header" style={styles.title}>{t('Want to visit')}</Text></View>
    {state.status === 'loading' && <Text style={styles.note}>{t('Loading saved bars…')}</Text>}
    {state.error && <>
      <Text accessibilityRole="alert" style={styles.note}>{t('Your saved bars could not be refreshed. Try again.')}</Text>
      <PrimaryButton label={t('Retry saved bars')} variant="secondary" disabled={state.refreshing} onPress={() => { void state.refresh(); }} />
    </>}
    {state.status === 'ready' && rows.length === 0 && <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{t('No saved bars yet')}</Text><Text style={styles.note}>{t('Save bars to find them here.')}</Text>
    </View>}
    {rows.map(row => {
      const id = parseUuid(row.bar_id)!;
      const venue = venues.find(item => item.id === id);
      const display = { id, name: venue?.name ?? t('Venue unavailable'), area: venue?.area ?? t('Neighborhood unavailable'), image: venue?.image ?? null, available: Boolean(venue) };
      return <View key={id} style={styles.row}>
        <View style={styles.copy}><ProfileActivityRow venue={display} summary={t('Saved {date}', { date: format.dateTime(row.created_at) })} onPress={() => onOpenVenue(id)} /></View>
        <BookmarkButton barId={id} name={display.name} />
      </View>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  section: { padding: theme.spacing.lg, gap: theme.spacing.md, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  heading: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 17 },
  note: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 19 },
  empty: { gap: theme.spacing.xs, paddingVertical: theme.spacing.md },
  emptyTitle: { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyBold, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }, copy: { flex: 1 },
});
