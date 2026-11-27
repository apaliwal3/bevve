import { contributionUuid } from '../../../../shared/contribution-contracts.ts';
import { decodeIncidentReport, decodePublishedSafetySummary, matchesIncidentRequest, validIncidentReview,
  type IncidentReport, type IncidentRequest, type IncidentReview, type PublishedSafetySummary } from '../../../../shared/safety-contracts.ts';
import { emptyIncidentDraft, incidentDraftReducer, incidentSubmission, type IncidentDraft, type IncidentDraftAction } from './extra-form-drafts.ts';
import type { accountSafetyRepository } from './account-safety-repository.ts';

export type IncidentOperation = { version: number; request: IncidentRequest | null; saving: boolean; error: boolean; saved: boolean };
export const emptyIncidentOperation: IncidentOperation = { version: 0, request: null, saving: false, error: false, saved: false };
export type SafetyPublicState = { status: 'loading' | 'ready' | 'error'; refreshing: boolean; error: boolean; rows: readonly PublishedSafetySummary[] };
export const emptySafetyPublicState: SafetyPublicState = { status: 'loading', refreshing: false, error: false, rows: [] };
export type IncidentReviewState = { draft: string; request: IncidentReview | null; saving: boolean; error: boolean };
export const emptyIncidentReview: IncidentReviewState = { draft: '', request: null, saving: false, error: false };
type Snapshot = {
  status: 'loading' | 'ready' | 'error'; refreshing: boolean; error: boolean; history: readonly IncidentReport[];
  drafts: Readonly<Record<string, IncidentDraft>>; operations: Readonly<Record<string, IncidentOperation>>;
  queueStatus: 'loading' | 'ready' | 'error'; queueRefreshing: boolean; queueError: boolean; isModerator: boolean;
  queue: readonly IncidentReport[]; reviews: Readonly<Record<string, IncidentReviewState>>;
  publicByVenue: Readonly<Record<string, SafetyPublicState>>;
};
type Catalog = { status: string; venues: readonly { id: string }[] };
export function createAccountSafetyStore(owner: string, repository: ReturnType<typeof accountSafetyRepository>, nextId: () => string) {
  let snapshot: Snapshot = { status: 'loading', refreshing: false, error: false, history: [], drafts: {}, operations: {},
    queueStatus: 'loading', queueRefreshing: false, queueError: false, isModerator: false, queue: [], reviews: {}, publicByVenue: {} };
  const initial = snapshot, listeners = new Set<() => void>();
  let active = false, generation = 0, revision = 0;
  let catalog: Catalog = { status: 'loading', venues: [] };
  let loading: Promise<void> | null = null, queueLoading: Promise<void> | null = null;
  const pending = new Map<string, Promise<void>>(), publicLoading = new Map<string, Promise<void>>(), publicAgain = new Set<string>();
  const publicVenues = new Set<string>();
  const confirmed = new Map<string, { revision: number; row: IncidentReport }>();
  const operation = (barId: string) => snapshot.operations[barId] ?? emptyIncidentOperation;
  const review = (id: string) => snapshot.reviews[id] ?? emptyIncidentReview;
  function publish(patch: Partial<Snapshot>) { snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()); }
  function setOperation(barId: string, op: IncidentOperation) { publish({ operations: { ...snapshot.operations, [barId]: op } }); }
  function setReview(id: string, value: IncidentReviewState) { publish({ reviews: { ...snapshot.reviews, [id]: value } }); }
  function setPublic(barId: string, value: SafetyPublicState) { publish({ publicByVenue: { ...snapshot.publicByVenue, [barId]: value } }); }
  function record(row: IncidentReport) {
    confirmed.set(row.id, { revision: ++revision, row });
    if (row.reporter_id === owner) publish({ history: [...snapshot.history.filter(item => item.id !== row.id), row] });
    publish({ queue: row.status === 'pending' && snapshot.isModerator
      ? [...snapshot.queue.filter(item => item.id !== row.id), row] : snapshot.queue.filter(item => item.id !== row.id) });
  }
  function accept(row: IncidentReport, request: IncidentRequest) {
    record(row);
    const op = operation(request.barId);
    if (op.request?.id === request.id) {
      setOperation(request.barId, { version: op.version + 1, request: null, saving: false, error: false, saved: true });
      publish({ drafts: { ...snapshot.drafts, [request.barId]: { ...emptyIncidentDraft } } });
    }
    if (row.status === 'approved') invalidatePublic(row.bar_id);
  }
  function refreshPublic(barId: string): Promise<void> {
    if (!contributionUuid(barId)) return Promise.resolve();
    // Child effects can request a venue before the provider's start effect.
    publicVenues.add(barId);
    if (!active) return Promise.resolve();
    const existing = publicLoading.get(barId); if (existing) return existing;
    const run = generation, previous = snapshot.publicByVenue[barId] ?? emptySafetyPublicState;
    setPublic(barId, { ...previous, refreshing: true });
    const promise = repository.loadPublic(barId).then(values => {
      if (!active || run !== generation || publicAgain.has(barId)) return;
      const rows = values.map(value => decodePublishedSafetySummary(value, barId));
      setPublic(barId, { status: 'ready', refreshing: false, error: false, rows });
    }).catch(() => {
      if (!active || run !== generation || publicAgain.has(barId)) return;
      const state = snapshot.publicByVenue[barId] ?? emptySafetyPublicState;
      setPublic(barId, { ...state, status: state.status === 'ready' ? 'ready' : 'error', refreshing: false, error: true });
    }).finally(() => {
      if (run !== generation) return;
      publicLoading.delete(barId);
      if (active && publicAgain.delete(barId)) void refreshPublic(barId);
    });
    publicLoading.set(barId, promise); return promise;
  }
  function invalidatePublic(barId: string) {
    if (!active || !snapshot.publicByVenue[barId]) return;
    if (publicLoading.has(barId)) publicAgain.add(barId); else void refreshPublic(barId);
  }
  function refresh(): Promise<void> {
    if (!active) return Promise.resolve();
    if (loading) return loading;
    const run = generation, before = revision;
    publish({ refreshing: true });
    loading = repository.load(owner).then(values => {
      if (!active || run !== generation) return;
      const history = new Map(values.map(value => { const row = decodeIncidentReport(value, owner); return [row.id, row] as const; }));
      for (const [id, write] of confirmed) if (write.revision > before && write.row.reporter_id === owner) history.set(id, write.row);
      publish({ status: 'ready', error: false, history: [...history.values()] });
      for (const op of Object.values(snapshot.operations)) {
        if (!op.request) continue;
        const request = op.request;
        const row = snapshot.history.find(item => matchesIncidentRequest(item, request, owner));
        if (row) accept(row, request);
      }
      for (const barId of Object.keys(snapshot.publicByVenue)) invalidatePublic(barId);
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
      const queue = new Map(data.queue.map(value => { const row = decodeIncidentReport(value); return [row.id, row] as const; }));
      for (const [id, write] of confirmed) if (write.revision > before) {
        if (write.row.status === 'pending') queue.set(id, write.row); else queue.delete(id);
      }
      publish({ queueStatus: 'ready', queueError: false, isModerator: data.isModerator, queue: data.isModerator ? [...queue.values()] : [] });
    }).catch(() => { if (active && run === generation) publish({ queueStatus: 'error', queueError: true, isModerator: false, queue: [] }); })
      .finally(() => { if (run === generation) { queueLoading = null; if (active) publish({ queueRefreshing: false }); } });
    return queueLoading;
  }
  function send(request: IncidentRequest): Promise<void> {
    const existing = pending.get(request.id); if (existing) return existing;
    const run = generation;
    setOperation(request.barId, { ...operation(request.barId), request, saving: true, error: false, saved: false });
    const promise = repository.submit(owner, request).then(value => {
      if (!active || run !== generation) throw new Error('Account changed');
      const row = decodeIncidentReport(value, owner);
      if (!matchesIncidentRequest(row, request, owner)) throw new Error('Mismatched incident response');
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
      publish({ operations: Object.fromEntries(Object.entries(snapshot.operations).map(([key, op]) => [key, op.saving ? { ...op, saving: false, error: true } : op])),
        reviews: Object.fromEntries(Object.entries(snapshot.reviews).map(([key, op]) => [key, op.saving ? { ...op, saving: false, error: true } : op])) });
      void refresh(); void refreshQueue();
      for (const barId of publicVenues) void refreshPublic(barId);
      return () => { active = false; generation++; loading = null; queueLoading = null; pending.clear(); publicLoading.clear(); publicAgain.clear(); };
    },
    refresh, refreshQueue, refreshPublic,
    refreshAll() { void refresh(); void refreshQueue(); for (const barId of Object.keys(snapshot.publicByVenue)) void refreshPublic(barId); },
    updateDraft(barId: string, action: IncidentDraftAction, version: number) {
      const op = operation(barId);
      if (!active || op.request || op.version !== version || !catalog.venues.some(row => row.id === barId)) return;
      publish({ drafts: { ...snapshot.drafts, [barId]: incidentDraftReducer(snapshot.drafts[barId] ?? emptyIncidentDraft, action) } });
      if (op.saved) setOperation(barId, { ...op, saved: false });
    },
    submit(barId: string, version: number): Promise<void> {
      const op = operation(barId), input = incidentSubmission(snapshot.drafts[barId] ?? emptyIncidentDraft);
      if (!active || snapshot.status !== 'ready' || catalog.status !== 'ready' || !catalog.venues.some(row => row.id === barId)) return Promise.reject(new Error('Incident reporting unavailable'));
      if (op.version !== version) return Promise.reject(new Error('Stale incident action'));
      if (op.request) return send(op.request);
      if (!input.ok) return Promise.reject(new Error('Invalid incident draft'));
      return send({ id: nextId(), barId, input: input.value });
    },
    retry(barId: string, requestId: string): Promise<void> {
      const request = operation(barId).request;
      if (!active || !request || request.id !== requestId) return Promise.reject(new Error('Incident unavailable'));
      return send(request);
    },
    updateReviewDraft(id: string, draft: string) {
      if (!active || !snapshot.isModerator || review(id).request || !snapshot.queue.some(row => row.id === id)) return;
      setReview(id, { ...review(id), draft });
    },
    moderate(id: string, decision: 'approved' | 'rejected'): Promise<void> {
      const current = review(id), key = `review:${id}`;
      if (!active || !snapshot.isModerator || snapshot.queueStatus !== 'ready' || !snapshot.queue.some(row => row.id === id)) return Promise.reject(new Error('Review unavailable'));
      if (current.request && current.request.decision !== decision) return Promise.reject(new Error('Retry the same review first'));
      const request = current.request ?? { id, decision, summary: decision === 'approved' ? current.draft.trim() : null };
      if (!validIncidentReview(request)) return Promise.reject(new Error('Invalid public summary'));
      const existing = pending.get(key); if (existing) return existing;
      const run = generation;
      setReview(id, { ...current, request, saving: true, error: false });
      const promise = repository.moderate(owner, request).then(value => {
        if (!active || run !== generation) throw new Error('Account changed');
        const row = decodeIncidentReport(value);
        if (row.id !== id || row.status !== decision) throw new Error('Mismatched incident review');
        record(row);
        const reviews = { ...snapshot.reviews }; delete reviews[id]; publish({ reviews });
        invalidatePublic(row.bar_id);
      }).catch(error => {
        if (active && run === generation) setReview(id, { ...review(id), request, saving: false, error: true });
        throw error;
      }).finally(() => { if (run === generation) pending.delete(key); });
      pending.set(key, promise); return promise;
    },
  };
}
