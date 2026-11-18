import {
  createPersonalComparisonState, pairKey, parseUuid, personalComparisonReducer, selectNextPair,
  type PersonalComparisonAction, type PersonalComparisonState, type UUID,
} from '../comparisons/comparison-state.ts';
import {
  createVenueComparisonController, getVenueComparisonPrompt, selectVenueComparisonOpponents, venueComparisonFlowReducer,
  type VenueComparisonAction, type VenueComparisonController, type VenueComparisonFlow,
} from '../comparisons/venue-comparison-flow.ts';
import {
  getUserVenueImpression, saveVenueImpression, type Impression, type VenueImpressionsState,
} from '../impressions/impression-state.ts';

export type OverlayToken = { overlayId: string; barId: string; catalogRevision: number };
type Overlay = { id: UUID; barId: UUID; step: 'impression' | 'comparisons' | 'contributions' };
export type RatingJourneyState = {
  comparisons: PersonalComparisonState;
  impressions: VenueImpressionsState;
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
    comparisons: controller.comparisons, impressions: {}, flows: {},
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
  const impression = getUserVenueImpression(state.impressions, state.comparisons.userId, barId)?.impression ?? null;
  const pending = controller.flow?.phase === 'comparisons';
  const hasOpponents = impression !== null && selectVenueComparisonOpponents({
    userId: state.comparisons.userId, currentVenueId: barId, impressions: state.impressions,
    catalogVenueIds: state.catalogIds, history: state.comparisons.history,
  }).length > 0;
  return {
    impression,
    step: overlay?.step ?? 'impression',
    pending,
    flowId: controller.flow?.id ?? null,
    canCompareAgain: impression !== null && !pending && hasOpponents,
    noOpponents: impression !== null && !pending && !hasOpponents,
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
  | (OverlayToken & { type: 'save-impression'; impression: Impression; at: string; flowId: string; resume: boolean })
  | (OverlayToken & { type: 'revisit'; intent: 'resume' | 'contributions'; userId: string; expectedFlowId: string | null })
  | (OverlayToken & { type: 'compare-again'; userId: string; expectedFlowId: string | null; flowId: string })
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
    return { ...state, overlay: { id, barId: bar, step: 'impression' }, usedOverlayIds: [...state.usedOverlayIds, id], comparisons: invalidateLegacyRound(state.comparisons) };
  }
  if (action.type === 'close') {
    if (uuid(action.overlayId) !== state.overlay?.id) return state;
    return { ...state, overlay: null, comparisons: invalidateLegacyRound(state.comparisons) };
  }
  const overlay = state.overlay;
  if (!overlay || uuid(action.overlayId) !== overlay.id || uuid(action.barId) !== overlay.barId || action.catalogRevision !== state.catalogRevision) return state;
  if (action.type === 'revisit' || action.type === 'compare-again') {
    const controller = controllerFor(state, overlay.barId);
    const expected = action.expectedFlowId === null ? null : uuid(action.expectedFlowId);
    if (overlay.step !== 'impression' || uuid(action.userId) !== state.comparisons.userId ||
      (action.expectedFlowId !== null && !expected) || expected !== (controller.flow?.id ?? null) ||
      !getUserVenueImpression(state.impressions, state.comparisons.userId, overlay.barId)) return state;
    if (action.type === 'revisit') {
      if (action.intent === 'resume' && controller.flow?.phase === 'comparisons') {
        return { ...state, overlay: { ...overlay, step: 'comparisons' } };
      }
      return action.intent === 'contributions' ? { ...state, overlay: { ...overlay, step: 'contributions' } } : state;
    }
    // A new batch is explicit and can only replace a finished batch. The existing
    // controller owns opponent selection, flow-ID reuse guards and vote validation.
    if (controller.flow?.phase === 'comparisons') return state;
    const begun = venueComparisonFlowReducer(controller, {
      type: 'begin', intent: 'compare-again', flowId: action.flowId, expectedFlowId: action.expectedFlowId,
      userId: action.userId, currentVenueId: overlay.barId, impressions: state.impressions, catalogVenueIds: state.catalogIds,
    });
    if (begun === controller) return state;
    return { ...mergeController(state, begun), overlay: { ...overlay, step: begun.flow?.phase === 'comparisons' ? 'comparisons' : 'contributions' } };
  }
  if (action.type === 'save-impression') {
    if (overlay.step !== 'impression' || !uuid(action.flowId) || state.usedFlowIds.includes(uuid(action.flowId)!)) return state;
    const previous = getUserVenueImpression(state.impressions, state.comparisons.userId, overlay.barId);
    const at = Date.parse(action.at);
    if (!Number.isFinite(at) || !['liked', 'fine', 'disliked'].includes(action.impression)) return state;
    const record = {
      user_id: state.comparisons.userId, bar_id: overlay.barId, impression: action.impression,
      source: 'demo' as const, updated_at: new Date(Math.max(at, previous ? Date.parse(previous.updated_at) + 1 : at)).toISOString(),
    };
    const impressions = previous?.impression === action.impression ? state.impressions : saveVenueImpression(state.impressions, record);
    let next = { ...state, impressions };
    const existing = state.flows[overlay.barId];
    // Saving an edit preserves pending progress. Unchanged revisits use separate
    // resume/contribution actions and never need to resubmit the impression.
    if (existing) {
      return { ...next, overlay: { ...overlay, step: action.resume && existing.phase === 'comparisons' ? 'comparisons' : 'contributions' } };
    }
    const controller = controllerFor(state, overlay.barId);
    const begun = venueComparisonFlowReducer(controller, {
      type: 'begin', flowId: action.flowId, expectedFlowId: null, userId: state.comparisons.userId,
      currentVenueId: overlay.barId, intent: 'after-impression', impressions, catalogVenueIds: state.catalogIds,
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
