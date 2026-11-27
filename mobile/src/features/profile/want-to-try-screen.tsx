import { useMemo, type ReactNode } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { FlowHeader } from '@/components/flow-header';
import { BookmarkButton } from '@/features/saved-bars/bookmark-button';
import { useSavedBars } from '@/features/saved-bars/saved-bars-provider';
import { parseUuid } from '@/features/comparisons/comparison-state';
import { venueFromWantToTryHref } from '@/features/venues/bar-details-navigation';
import { useTranslation } from '@/localization/language-provider';
import type { Venue } from '@/types/venue';
import { ProfileActivityRow, ProfileEmptyState } from './profile-activity-components';
import { ProfileList } from './profile-list';
import { SavedBarsFeedback } from './saved-bars-feedback';
import { backToProfile } from './profile-navigation';

export function WantToTryScreen({ venues, feedback, refreshing = false, onRefresh, sampleVenueIds = [] }: {
  venues: readonly Venue[]; feedback?: ReactNode; refreshing?: boolean; onRefresh?: () => void; sampleVenueIds?: readonly string[];
}) {
  const state = useSavedBars(), { t, format } = useTranslation();
  const rows = useMemo(() => {
    const byId = new Map(venues.map(venue => [venue.id.toLowerCase(), venue]));
    return Object.values(state.bars).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || a.bar_id.localeCompare(b.bar_id)).flatMap(row => {
      const id = parseUuid(row.bar_id);
      if (!id) return [];
      const venue = byId.get(id);
      return [{ ...row, venue: { id, name: venue?.name ?? t('Venue unavailable'), area: venue?.area ?? t('Neighborhood unavailable'), image: venue?.image ?? null, available: Boolean(venue) } }];
    });
  }, [state.bars, venues, t]);
  const busy = refreshing || state.refreshing;
  function refresh() {
    if (busy) return;
    void state.refresh();
    onRefresh?.();
  }
  return <ProfileList secondary data={rows} keyExtractor={row => row.bar_id} refreshing={busy} onRefresh={refresh}
    header={<View style={styles.header}>
      <FlowHeader title={t('Want to Try')} eyebrow={t('Profile')} backLabel={t('Back to Profile')} onBack={() => backToProfile(router)} />
      {feedback}
      <SavedBarsFeedback />
    </View>}
    empty={state.status === 'ready' ? <ProfileEmptyState title={t('No saved bars yet')} message={t('Save bars to find them here.')} /> : null}
    renderItem={({ item }) => <View style={styles.row}>
      <View style={styles.copy}><ProfileActivityRow venue={item.venue} summary={t('Saved {date}', { date: format.dateTime(item.created_at) })}
        sample={sampleVenueIds.includes(item.venue.id)} onPress={() => router.push(venueFromWantToTryHref(item.venue.id))} /></View>
      <BookmarkButton barId={item.bar_id} name={item.venue.name} />
    </View>} />;
}
const styles = StyleSheet.create({
  header: { gap: 16, paddingBottom: 20 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, copy: { flex: 1 },
});
