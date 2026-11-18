import {
  createPersonalComparisonState, pairKey, parseUuid, personalComparisonReducer, selectNextPair,
  type PersonalComparisonAction, type PersonalComparisonState, type UUID,
} from '../comparisons/comparison-state.ts';
import {
  createVenueComparisonController, getVenueComparisonPrompt, venueComparisonFlowReducer,
  type VenueComparisonAction, type VenueComparisonController, type VenueComparisonFlow,
} from '../comparisons/venue-comparison-flow.ts';
import {
  getUserVenueSentiment, saveVenueSentiment, type Sentiment, type VenueSentimentsState,
} from '../sentiments/sentiment-state.ts';

export type OverlayToken = { overlayId: string; barId: string; catalogRevision: number };
type Overlay = { id: UUID; barId: UUID; step: 'sentiment' | 'comparisons' | 'contributions' };
export type RatingJourneyState = {
  comparisons: PersonalComparisonState;
  sentiments: VenueSentimentsState;
  // Per-venue progress only; comparison events live exclusively in comparisons.
  flows: Readonly<Partial<Record<string, VenueComparisonFlow>>>;
  knownVenueIds: readonly UUID[];
  usedFlowIds: readonly UUID[];
  usedOverlayIds: readonly UUID[];
  catalogIds: readonly UUID[];
  catalogRevision: number;
  overlay: Overlay | null;
};

const uuid = (value: string) => parseUuid(value);
const catalogIds = (ids: readonly string[]) => [...new Set(ids.flatMap((id) => { const parsed = uuid(id); return parsed ? [parsed] : []; }))].sort();

export function createRatingJourneyState(userId: string, ids: readonly string[]): RatingJourneyState {
  const controller = createVenueComparisonController(createPersonalComparisonState(userId, ids), {});
  return {
    comparisons: controller.comparisons, sentiments: {}, flows: {},
    knownVenueIds: controller.knownVenueIds, usedFlowIds: controller.usedFlowIds, usedOverlayIds: [],
    catalogIds: catalogIds(ids), catalogRevision: 0, overlay: null,
  };
}

function controllerFor(state: RatingJourneyState, barId: string): VenueComparisonController {
  return { comparisons: state.comparisons, flow: state.flows[barId] ?? null, knownVenueIds: state.knownVenueIds, usedFlowIds: state.usedFlowIds };
}

function mergeController(state: RatingJourneyState, controller: VenueComparisonController): RatingJourneyState {
  return {
    ...state, comparisons: controller.comparisons,
    knownVenueIds: controller.knownVenueIds, usedFlowIds: controller.usedFlowIds,
    flows: controller.flow ? { ...state.flows, [controller.flow.currentVenueId]: controller.flow } : state.flows,
  };
}

function invalidateLegacyRound(comparisons: PersonalComparisonState): PersonalComparisonState {
  return { ...comparisons, round: comparisons.round + 1, phase: 'ready', feedback: null };
}

export function getRatingJourneyView(state: RatingJourneyState, barId: string) {
  const id = uuid(barId);
  const overlay = id && state.overlay?.barId === id ? state.overlay : null;
  const controller = controllerFor(state, id ?? '');
  const prompt = getVenueComparisonPrompt(controller);
  return {
    sentiment: getUserVenueSentiment(state.sentiments, state.comparisons.userId, barId)?.sentiment ?? null,
    step: overlay?.step ?? 'sentiment',
    pending: controller.flow?.phase === 'comparisons',
    prompt: overlay?.step === 'comparisons' ? prompt : null,
    progress: controller.flow ? { current: controller.flow.round + 1, total: controller.flow.opponentIds.length } : null,
    token: overlay ? { overlayId: overlay.id, barId: overlay.barId, catalogRevision: state.catalogRevision } : null,
  };
}

export type RatingJourneyAction =
  | { type: 'open'; overlayId: string; barId: string }
  | { type: 'close'; overlayId: string }
  | { type: 'catalog'; venueIds: readonly string[] }
  | { type: 'legacy'; action: PersonalComparisonAction }
  | (OverlayToken & { type: 'save-sentiment'; sentiment: Sentiment; at: string; flowId: string; resume: boolean })
  | (OverlayToken & { type: 'flow'; action: Exclude<VenueComparisonAction, { type: 'begin' }> });

export function ratingJourneyReducer(state: RatingJourneyState, action: RatingJourneyAction): RatingJourneyState {
  if (action.type === 'catalog') {
    const ids = catalogIds(action.venueIds);
    if (ids.join('|') === state.catalogIds.join('|')) return state;
    const available = new Set(ids);
    const flows = { ...state.flows };
    for (const [id, flow] of Object.entries(flows)) {
      if (!flow || flow.phase !== 'comparisons' || !available.has(flow.currentVenueId)) continue;
      const opponents = [...flow.opponentIds.slice(0, flow.round), ...flow.opponentIds.slice(flow.round).filter((opponent) => available.has(opponent))];
      const finished = flow.round >= opponents.length;
      flows[id] = { ...flow, opponentIds: opponents, phase: finished ? 'contributions' : 'comparisons', finishReason: finished ? 'completed' : null };
    }
    const legacy = invalidateLegacyRound(state.comparisons);
    const pair = selectNextPair(ids, legacy.presentations, legacy.pair, legacy.round);
    let overlay = state.overlay && available.has(state.overlay.barId) ? state.overlay : null;
    if (overlay?.step === 'comparisons' && flows[overlay.barId]?.phase === 'contributions') overlay = { ...overlay, step: 'contributions' };
    const presentations = pair ? { ...legacy.presentations, [pairKey(pair)]: (legacy.presentations[pairKey(pair)] ?? 0) + 1 } : legacy.presentations;
    return { ...state, catalogIds: ids, catalogRevision: state.catalogRevision + 1, flows, overlay, comparisons: { ...legacy, venueIds: ids, pair, presentations } };
  }
  if (action.type === 'legacy') {
    // The native modal owns interaction while open; invalidate old tab callbacks.
    if (state.overlay) return state;
    const comparisons = personalComparisonReducer(state.comparisons, action.action);
    return comparisons === state.comparisons ? state : { ...state, comparisons };
  }
  if (action.type === 'open') {
    const id = uuid(action.overlayId), bar = uuid(action.barId);
    if (!id || !bar || !state.catalogIds.includes(bar) || state.usedOverlayIds.includes(id)) return state;
    return { ...state, overlay: { id, barId: bar, step: 'sentiment' }, usedOverlayIds: [...state.usedOverlayIds, id], comparisons: invalidateLegacyRound(state.comparisons) };
  }
  if (action.type === 'close') {
    if (uuid(action.overlayId) !== state.overlay?.id) return state;
    return { ...state, overlay: null, comparisons: invalidateLegacyRound(state.comparisons) };
  }
  const overlay = state.overlay;
  if (!overlay || uuid(action.overlayId) !== overlay.id || uuid(action.barId) !== overlay.barId || action.catalogRevision !== state.catalogRevision) return state;
  if (action.type === 'save-sentiment') {
    if (overlay.step !== 'sentiment' || !uuid(action.flowId) || state.usedFlowIds.includes(uuid(action.flowId)!)) return state;
    const previous = getUserVenueSentiment(state.sentiments, state.comparisons.userId, overlay.barId);
    const at = Date.parse(action.at);
    if (!Number.isFinite(at) || !['liked', 'fine', 'disliked'].includes(action.sentiment)) return state;
    const record = {
      user_id: state.comparisons.userId, bar_id: overlay.barId, sentiment: action.sentiment,
      source: 'demo' as const, updated_at: new Date(Math.max(at, previous ? Date.parse(previous.updated_at) + 1 : at)).toISOString(),
    };
    const sentiments = previous?.sentiment === action.sentiment ? state.sentiments : saveVenueSentiment(state.sentiments, record);
    let next = { ...state, sentiments };
    const existing = state.flows[overlay.barId];
    // Reopening preserves pending progress; resuming is an explicit save action.
    if (existing) {
      return { ...next, overlay: { ...overlay, step: action.resume && existing.phase === 'comparisons' ? 'comparisons' : 'contributions' } };
    }
    const controller = controllerFor(state, overlay.barId);
    const begun = venueComparisonFlowReducer(controller, {
      type: 'begin', flowId: action.flowId, expectedFlowId: null, userId: state.comparisons.userId,
      currentVenueId: overlay.barId, intent: 'after-sentiment', sentiments, catalogVenueIds: state.catalogIds,
    });
    next = mergeController(next, begun);
    return { ...next, overlay: { ...overlay, step: begun.flow?.phase === 'comparisons' ? 'comparisons' : 'contributions' } };
  }
  if (action.type === 'flow' && overlay.step === 'comparisons') {
    const controller = controllerFor(state, overlay.barId);
    const changed = venueComparisonFlowReducer(controller, action.action);
    if (changed === controller) return state;
    const next = mergeController(state, changed);
    return { ...next, overlay: { ...overlay, step: changed.flow?.phase === 'comparisons' ? 'comparisons' : 'contributions' } };
  }
  return state;
}
