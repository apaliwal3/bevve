import type { CatalogDrinkRow, CatalogVenueRow, ImpressionValue, SavedImpressionRow } from '../../../../shared/venue-contracts.ts';
import type { catalogRepository } from './catalog-repository.ts';

export type CatalogSnapshot = {
  status: 'loading' | 'ready' | 'error';
  refreshing: boolean;
  error: boolean;
  venues: readonly CatalogVenueRow[];
  drinks: readonly CatalogDrinkRow[];
  impressions: Readonly<Record<string, SavedImpressionRow>>;
  saving: Readonly<Record<string, boolean>>;
};
type Repository = ReturnType<typeof catalogRepository>;

export function createCatalogStore(userId: string, repository: Repository) {
  let snapshot: CatalogSnapshot = { status: 'loading', refreshing: false, error: false,
    venues: [], drinks: [], impressions: {}, saving: {} };
  const serverSnapshot = snapshot;
  const listeners = new Set<() => void>();
  let active = false;
  let generation = 0;
  let revision = 0;
  let loading: Promise<void> | null = null;
  let refreshAgain = false;
  const written = new Map<string, { revision: number; row: SavedImpressionRow }>();
  const pending = new Map<string, { value: ImpressionValue; promise: Promise<void> }>();
  function publish(patch: Partial<CatalogSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
  }
  function refresh(): Promise<void> {
    if (!active) return Promise.resolve();
    if (loading) return loading;
    const requestGeneration = generation;
    const beforeWrites = revision;
    publish({ refreshing: true });
    loading = repository.load(userId).then(data => {
      if (!active || requestGeneration !== generation) return;
      const impressions = Object.fromEntries(data.impressions.map(row => [row.bar_id, row]));
      // Preserve acknowledged saves that completed after this read began.
      for (const [id, write] of written) {
        if (write.revision > beforeWrites) impressions[id] = write.row;
      }
      publish({ status: 'ready', error: false, venues: data.venues, drinks: data.drinks, impressions });
    }).catch(() => {
      if (active && requestGeneration === generation) publish({ status: snapshot.status === 'ready' ? 'ready' : 'error', error: true });
    }).finally(() => {
      if (requestGeneration === generation) {
        loading = null;
        if (active) publish({ refreshing: false });
        if (active && refreshAgain) { refreshAgain = false; void refresh(); }
      }
    });
    return loading;
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() {
      active = true;
      generation++;
      loading = null;
      refreshAgain = false;
      if (Object.keys(snapshot.saving).length) publish({ saving: {} });
      void refresh();
      return () => { active = false; generation++; loading = null; pending.clear(); };
    },
    refresh,
    invalidate() {
      if (!active) return;
      if (loading) refreshAgain = true;
      else void refresh();
    },
    save(barId: string, value: ImpressionValue): Promise<void> {
      if (!active || snapshot.status !== 'ready' || !snapshot.venues.some(venue => venue.id === barId) ||
        !['liked','fine','disliked'].includes(value)) return Promise.reject(new Error('Venue unavailable'));
      const existing = pending.get(barId);
      if (existing) return existing.value === value ? existing.promise : Promise.reject(new Error('Save already in progress'));
      const requestGeneration = generation;
      publish({ saving: { ...snapshot.saving, [barId]: true } });
      const promise = repository.save(userId, barId, value).then(row => {
        if (!active || requestGeneration !== generation) throw new Error('Account changed');
        written.set(barId, { revision: ++revision, row });
        publish({ impressions: { ...snapshot.impressions, [barId]: row } });
        // Reads can fail independently after a successful write; never tell the
        // user that a committed impression failed just because refresh is offline.
        if (loading) refreshAgain = true;
        else void refresh();
      }).finally(() => {
        if (requestGeneration === generation) {
          pending.delete(barId);
          if (active) publish({ saving: { ...snapshot.saving, [barId]: false } });
        }
      });
      pending.set(barId, { value, promise });
      return promise;
    },
  };
}
