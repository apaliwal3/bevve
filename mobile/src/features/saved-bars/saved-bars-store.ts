import { decodeSavedBar, savedBarId, type SavedBar } from '../../../../shared/saved-bar-contracts.ts';
import type { SavedBarsRepository } from './saved-bars-repository.ts';

type Operation = { saving: boolean; error: boolean; target: boolean };
type Snapshot = { status: 'loading' | 'ready' | 'error'; refreshing: boolean; error: boolean;
  bars: Readonly<Record<string, SavedBar>>; operations: Readonly<Record<string, Operation>> };

export function createSavedBarsStore(owner: string, repository: SavedBarsRepository | null, now = () => new Date().toISOString()) {
  let snapshot: Snapshot = { status: repository ? 'loading' : 'ready', refreshing: false, error: false, bars: {}, operations: {} };
  const initial = snapshot, listeners = new Set<() => void>();
  let active = false, generation = 0, revision = 0, loading: Promise<void> | null = null;
  const writes = new Map<string, { revision: number; row: SavedBar | null }>();
  const pending = new Map<string, { target: boolean; promise: Promise<void> }>();
  function publish(patch: Partial<Snapshot>) { snapshot = { ...snapshot, ...patch }; listeners.forEach(fn => fn()); }
  function operation(id: string, value: Operation) { publish({ operations: { ...snapshot.operations, [id]: value } }); }
  function refresh(): Promise<void> {
    if (!active || !repository) return Promise.resolve();
    if (loading) return loading;
    const run = generation, before = revision;
    publish({ refreshing: true });
    loading = repository.load(owner).then(rows => {
      if (!active || run !== generation) return;
      const bars = Object.fromEntries(rows.map(value => { const row = decodeSavedBar(value, owner); return [row.bar_id, row]; }));
      for (const [id, write] of writes) if (write.revision > before) {
        if (write.row) bars[id] = write.row; else delete bars[id];
      }
      const operations = { ...snapshot.operations };
      for (const [id, op] of Object.entries(operations)) if (op.error && Boolean(bars[id]) === op.target) delete operations[id];
      publish({ bars, operations, status: 'ready', error: false });
    }).catch(() => { if (active && run === generation) publish({ error: true, status: snapshot.status === 'ready' ? 'ready' : 'error' }); })
      .finally(() => { if (run === generation) { loading = null; if (active) publish({ refreshing: false }); } });
    return loading;
  }
  return {
    getSnapshot: () => snapshot, getServerSnapshot: () => initial,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    start() {
      active = true; generation++;
      publish({ operations: Object.fromEntries(Object.entries(snapshot.operations).map(([id, op]) => [id, op.saving ? { ...op, saving: false, error: true } : op])) });
      void refresh();
      return () => { active = false; generation++; loading = null; pending.clear(); };
    },
    refresh,
    setSaved(barId: string, target: boolean): Promise<void> {
      if (!active || snapshot.status !== 'ready' || !savedBarId(barId)) return Promise.reject(new Error('Saved bars unavailable'));
      const inFlight = pending.get(barId);
      if (inFlight) return inFlight.target === target ? inFlight.promise : Promise.reject(new Error('Bookmark update in progress'));
      if (Boolean(snapshot.bars[barId]) === target && !snapshot.operations[barId]?.error) return Promise.resolve();
      const run = generation;
      operation(barId, { target, saving: true, error: false });
      const promise = Promise.resolve().then(() => repository ? repository.setSaved(owner, barId, target)
        : target ? { user_id: owner, bar_id: barId, created_at: now() } : null).then(result => {
        if (!active || run !== generation) throw new Error('Account changed');
        const row = result === null ? null : decodeSavedBar(result, owner);
        if (Boolean(row) !== target || row && row.bar_id !== barId) throw new Error('Mismatched bookmark response');
        writes.set(barId, { revision: ++revision, row });
        const bars = { ...snapshot.bars }, operations = { ...snapshot.operations };
        if (row) bars[barId] = row; else delete bars[barId];
        delete operations[barId]; publish({ bars, operations });
      }).catch(error => {
        if (active && run === generation) operation(barId, { target, saving: false, error: true });
        throw error;
      }).finally(() => { if (run === generation) pending.delete(barId); });
      pending.set(barId, { target, promise });
      return promise;
    },
  };
}
