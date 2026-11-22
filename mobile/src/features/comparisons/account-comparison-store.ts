import type { CatalogVenueRow, SavedImpressionRow } from '../../../../shared/venue-contracts.ts';
import { savedImpressions } from '../catalog/catalog-adapters.ts';
import { calculatePersonalRankings, type PersonalComparison } from './comparison-state.ts';
import { selectVenueComparisonOpponents } from './venue-comparison-flow.ts';
import type { accountComparisonRepository, ComparisonRequest } from './account-comparison-repository.ts';

export type AccountBatch = {
  id: string; opponents: readonly string[]; round: number;
  attempt: ComparisonRequest | null; saving: boolean; error: boolean;
};
export type AccountPromptToken = { barId: string; batchId: string; round: number };
type Snapshot = {
  status: 'loading' | 'ready' | 'error'; refreshing: boolean; error: boolean;
  history: readonly PersonalComparison[]; batches: Readonly<Record<string, AccountBatch>>;
};
type Catalog = { venues: readonly CatalogVenueRow[]; impressions: Readonly<Record<string, SavedImpressionRow>> };

// Batches are deliberately session-only. Confirmed votes are immutable server
// history; neither opening an overlay nor restoring a session creates a vote.
export function createAccountComparisonStore(userId: string, repository: ReturnType<typeof accountComparisonRepository>, nextId: () => string) {
  let snapshot: Snapshot = { status: 'loading', refreshing: false, error: false, history: [], batches: {} };
  const initial = snapshot;
  let catalog: Catalog = { venues: [], impressions: {} };
  let active = false, generation = 0;
  let loading: Promise<void> | null = null;
  const acknowledged = new Map<string, PersonalComparison>();
  const pending = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();
  function publish(patch: Partial<Snapshot>) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
  }
  function matching(token: AccountPromptToken) {
    const batch = snapshot.batches[token.barId];
    return batch?.id === token.batchId && batch.round === token.round && batch.round < batch.opponents.length ? batch : null;
  }
  function setBatch(barId: string, batch: AccountBatch) { publish({ batches: { ...snapshot.batches, [barId]: batch } }); }
  function accept(row: PersonalComparison) {
    acknowledged.set(row.id, row);
    const history = [...new Map([...snapshot.history, row].map(item => [item.id, item])).values()];
    publish({ history });
    for (const [barId, batch] of Object.entries(snapshot.batches)) {
      if (batch.attempt?.id === row.id && batch.attempt.winnerId === row.winner_bar_id && batch.attempt.loserId === row.loser_bar_id)
        setBatch(barId, { ...batch, round: batch.round + 1, attempt: null, saving: false, error: false });
    }
  }
  function refresh(): Promise<void> {
    if (!active) return Promise.resolve();
    if (loading) return loading;
    const run = generation;
    publish({ refreshing: true });
    loading = repository.load(userId).then(rows => {
      if (!active || run !== generation) return;
      const history = [...new Map([...rows, ...acknowledged.values()].map(row => [row.id, row])).values()];
      publish({ history, status: 'ready', error: false });
      // Recover an acknowledged server write even when its original response
      // was lost. Reopening and retrying otherwise reuses the same request ID.
      for (const row of history) {
        if (Object.values(snapshot.batches).some(batch => batch.attempt?.id === row.id)) accept(row);
      }
    }).catch(() => {
      if (active && run === generation) publish({ error: true, status: snapshot.status === 'ready' ? 'ready' : 'error' });
    }).finally(() => {
      if (run === generation) { loading = null; if (active) publish({ refreshing: false }); }
    });
    return loading;
  }
  return {
    getSnapshot: () => snapshot, getServerSnapshot: () => initial,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setCatalog(value: Catalog) { catalog = value; },
    start() {
      active = true; generation++; loading = null;
      publish({ batches: Object.fromEntries(Object.entries(snapshot.batches).map(([id, batch]) =>
        [id, batch.saving ? { ...batch, saving: false, error: true } : batch])) });
      void refresh();
      return () => { active = false; generation++; loading = null; pending.clear(); };
    },
    refresh,
    begin(barId: string, expectedBatchId: string | null) {
      if (!active || snapshot.status !== 'ready') return;
      const previous = snapshot.batches[barId];
      if ((previous?.id ?? null) !== expectedBatchId || (previous && previous.round < previous.opponents.length)) return;
      const opponents = selectVenueComparisonOpponents({ userId, currentVenueId: barId,
        impressions: savedImpressions(catalog.impressions, catalog.venues), catalogVenueIds: catalog.venues.map(row => row.id), history: snapshot.history });
      setBatch(barId, { id: nextId(), opponents, round: 0, attempt: null, saving: false, error: false });
    },
    skip(token: AccountPromptToken, remaining = false) {
      const batch = matching(token);
      if (!active || !batch || batch.attempt || batch.saving) return;
      setBatch(token.barId, { ...batch, round: remaining ? batch.opponents.length : batch.round + 1 });
    },
    choose(token: AccountPromptToken, winnerId: string): Promise<void> {
      const batch = matching(token);
      if (!active || snapshot.status !== 'ready' || !batch) return Promise.reject(new Error('Comparison unavailable'));
      const pair = [token.barId, batch.opponents[batch.round]];
      if (!pair.includes(winnerId) || !pair.every(id => catalog.venues.some(row => row.id === id) && catalog.impressions[id]?.user_id === userId))
        return Promise.reject(new Error('Venue unavailable'));
      if (batch.attempt && batch.attempt.winnerId !== winnerId) return Promise.reject(new Error('Retry the pending choice first'));
      const request = batch.attempt ?? { id: nextId(), winnerId, loserId: pair.find(id => id !== winnerId)! };
      const inFlight = pending.get(request.id);
      if (inFlight) return inFlight;
      const run = generation;
      setBatch(token.barId, { ...batch, attempt: request, saving: true, error: false });
      const promise = repository.save(userId, request).then(row => {
        if (!active || run !== generation) throw new Error('Account changed');
        accept(row);
      }).catch(error => {
        const current = matching(token);
        if (active && run === generation && current?.attempt?.id === request.id) setBatch(token.barId, { ...current, saving: false, error: true });
        throw error;
      }).finally(() => { if (run === generation) pending.delete(request.id); });
      pending.set(request.id, promise);
      return promise;
    },
    rankings: () => calculatePersonalRankings(snapshot.history),
  };
}
