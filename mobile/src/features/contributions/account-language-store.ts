import { decodeLanguageSuggestion, matchesLanguageRequest, validLanguageCode,
  type LanguageRequest, type LanguageSuggestion, type VenueLanguageCode } from '../../../../shared/language-contracts.ts';
import type { accountLanguageRepository } from './account-language-repository.ts';

export type LanguageOperation = { request: LanguageRequest | null; saving: boolean; error: boolean; saved: boolean; version: number };
export const emptyLanguageOperation: LanguageOperation = { request: null, saving: false, error: false, saved: false, version: 0 };
type ReviewOperation = { decision: 'approved' | 'rejected'; saving: boolean; error: boolean };
type Snapshot = {
  status: 'loading' | 'ready' | 'error'; refreshing: boolean; error: boolean;
  history: readonly LanguageSuggestion[]; operations: Readonly<Record<string, LanguageOperation>>;
  queueStatus: 'loading' | 'ready' | 'error'; queueRefreshing: boolean; queueError: boolean;
  isModerator: boolean; queue: readonly LanguageSuggestion[]; reviews: Readonly<Record<string, ReviewOperation>>;
};
type Catalog = { status: string; venues: readonly { id: string; languages: readonly { code: string }[] }[] };
export function createAccountLanguageStore(owner: string, repository: ReturnType<typeof accountLanguageRepository>, nextId: () => string, invalidate: () => void) {
  let snapshot: Snapshot = { status: 'loading', refreshing: false, error: false, history: [], operations: {},
    queueStatus: 'loading', queueRefreshing: false, queueError: false, isModerator: false, queue: [], reviews: {} };
  const initial = snapshot, listeners = new Set<() => void>();
  let active = false, generation = 0, revision = 0;
  let catalog: Catalog = { status: 'loading', venues: [] };
  let loading: Promise<void> | null = null, queueLoading: Promise<void> | null = null;
  const pending = new Map<string, Promise<void>>();
  const confirmed = new Map<string, { revision: number; row: LanguageSuggestion }>();
  function publish(patch: Partial<Snapshot>) { snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()); }
  const operation = (barId: string) => snapshot.operations[barId] ?? emptyLanguageOperation;
  function setOperation(barId: string, value: LanguageOperation) { publish({ operations: { ...snapshot.operations, [barId]: value } }); }
  function record(row: LanguageSuggestion) {
    confirmed.set(row.id, { revision: ++revision, row });
    if (row.user_id === owner) publish({ history: [...snapshot.history.filter(item => item.id !== row.id), row] });
    publish({ queue: row.status === 'pending' && snapshot.isModerator
      ? [...snapshot.queue.filter(item => item.id !== row.id), row] : snapshot.queue.filter(item => item.id !== row.id) });
  }
  function accept(row: LanguageSuggestion, request: LanguageRequest) {
    record(row);
    const op = operation(request.barId);
    if (op.request?.id === request.id) setOperation(request.barId, { request: null, saving: false, error: false, saved: true, version: op.version + 1 });
    invalidate();
  }
  function refresh(): Promise<void> {
    if (!active) return Promise.resolve();
    if (loading) return loading;
    const run = generation, before = revision;
    publish({ refreshing: true });
    loading = repository.load(owner).then(rows => {
      if (!active || run !== generation) return;
      const history = new Map(rows.map(value => { const row = decodeLanguageSuggestion(value, owner); return [row.id, row] as const; }));
      for (const [id, write] of confirmed) if (write.revision > before && write.row.user_id === owner) history.set(id, write.row);
      publish({ status: 'ready', error: false, history: [...history.values()] });
      for (const op of Object.values(snapshot.operations)) {
        if (!op.request) continue;
        const request = op.request;
        const row = snapshot.history.find(item => item.id === request.id && matchesLanguageRequest(item, request, owner));
        if (row) accept(row, request);
      }
      // A review on another device may have changed approved venue languages.
      invalidate();
    }).catch(() => { if (active && run === generation) publish({ status: snapshot.status === 'ready' ? 'ready' : 'error', error: true }); })
      .finally(() => { if (run === generation) { loading = null; if (active) publish({ refreshing: false }); } });
    return loading;
  }
  function refreshQueue(): Promise<void> {
    if (!active) return Promise.resolve();
    if (queueLoading) return queueLoading;
    const run = generation, before = revision;
    publish({ queueRefreshing: true });
    queueLoading = repository.loadQueue(owner).then(data => {
      if (!active || run !== generation) return;
      const queue = new Map(data.queue.map(value => { const row = decodeLanguageSuggestion(value); return [row.id, row] as const; }));
      for (const [id, write] of confirmed) if (write.revision > before) {
        if (write.row.status === 'pending') queue.set(id, write.row); else queue.delete(id);
      }
      publish({ queueStatus: 'ready', queueError: false, isModerator: data.isModerator, queue: data.isModerator ? [...queue.values()] : [] });
    }).catch(() => { if (active && run === generation) publish({ queueStatus: 'error', queueError: true, isModerator: false, queue: [] }); })
      .finally(() => { if (run === generation) { queueLoading = null; if (active) publish({ queueRefreshing: false }); } });
    return queueLoading;
  }
  function send(request: LanguageRequest): Promise<void> {
    const existing = pending.get(request.id); if (existing) return existing;
    const run = generation;
    setOperation(request.barId, { ...operation(request.barId), request, saving: true, error: false, saved: false });
    const promise = repository.submit(owner, request).then(value => {
      if (!active || run !== generation) throw new Error('Account changed');
      const row = decodeLanguageSuggestion(value, owner);
      if (!matchesLanguageRequest(row, request, owner)) throw new Error('Mismatched language suggestion');
      accept(row, request);
    }).catch(error => {
      const current = operation(request.barId);
      if (active && run === generation && current.request?.id === request.id) setOperation(request.barId, { ...current, saving: false, error: true });
      throw error;
    }).finally(() => { if (run === generation) pending.delete(request.id); });
    pending.set(request.id, promise); return promise;
  }
  return {
    getSnapshot: () => snapshot, getServerSnapshot: () => initial,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setCatalog(value: Catalog) { catalog = value; },
    start() {
      active = true; generation++;
      publish({ operations: Object.fromEntries(Object.entries(snapshot.operations).map(([id, op]) => [id, op.saving ? { ...op, saving: false, error: true } : op])),
        reviews: Object.fromEntries(Object.entries(snapshot.reviews).map(([id, op]) => [id, op.saving ? { ...op, saving: false, error: true } : op])) });
      void refresh(); void refreshQueue();
      return () => { active = false; generation++; loading = null; queueLoading = null; pending.clear(); };
    },
    refresh, refreshQueue,
    submit(barId: string, code: VenueLanguageCode, version: number): Promise<void> {
      const op = operation(barId), venue = catalog.venues.find(row => row.id === barId);
      if (!active || snapshot.status !== 'ready' || catalog.status !== 'ready' || !venue || !validLanguageCode(code)) return Promise.reject(new Error('Language suggestions unavailable'));
      if (op.version !== version) return Promise.reject(new Error('Stale language action'));
      if (op.request && op.request.code !== code) return Promise.reject(new Error('Retry the pending suggestion first'));
      if (!op.request && (venue.languages.some(row => row.code === code) || snapshot.history.some(row => row.bar_id === barId && row.language_code === code && row.status === 'pending'))) return Promise.reject(new Error('Language already associated or pending'));
      return send(op.request ?? { id: nextId(), barId, code });
    },
    retry(barId: string, requestId: string): Promise<void> {
      const request = operation(barId).request;
      if (!active || !request || request.id !== requestId) return Promise.reject(new Error('Suggestion unavailable'));
      return send(request);
    },
    moderate(id: string, decision: 'approved' | 'rejected'): Promise<void> {
      const op = snapshot.reviews[id], key = `review:${id}`;
      if (!active || !snapshot.isModerator || snapshot.queueStatus !== 'ready' || !snapshot.queue.some(row => row.id === id)) return Promise.reject(new Error('Review unavailable'));
      if (op && op.decision !== decision) return Promise.reject(new Error('Retry the pending decision first'));
      const existing = pending.get(key); if (existing) return existing;
      const run = generation;
      publish({ reviews: { ...snapshot.reviews, [id]: { decision, saving: true, error: false } } });
      const promise = repository.moderate(owner, id, decision).then(value => {
        if (!active || run !== generation) throw new Error('Account changed');
        const row = decodeLanguageSuggestion(value);
        if (row.id !== id || row.status !== decision) throw new Error('Mismatched language review');
        record(row);
        const reviews = { ...snapshot.reviews }; delete reviews[id]; publish({ reviews });
        invalidate();
      }).catch(error => {
        if (active && run === generation) publish({ reviews: { ...snapshot.reviews, [id]: { decision, saving: false, error: true } } });
        throw error;
      }).finally(() => { if (run === generation) pending.delete(key); });
      pending.set(key, promise); return promise;
    },
  };
}
