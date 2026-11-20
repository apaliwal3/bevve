import type { FivePointScore } from '../../types/five-point-score';
import type { BathroomScores, CrowdLevel } from './contribution-state';

export type BathroomDraft = { [Key in keyof BathroomScores]: FivePointScore | null };

export function bathroomDraftFromSaved(saved: BathroomScores | null): BathroomDraft {
  return {
    cleanliness: saved?.cleanliness ?? null,
    accessibility: saved?.accessibility ?? null,
    wait_time: saved?.wait_time ?? null,
  };
}

export function bathroomDraftReducer(
  draft: BathroomDraft,
  action: { type: 'rate'; category: keyof BathroomScores; rating: FivePointScore }
    | { type: 'cancel'; saved: BathroomScores | null },
): BathroomDraft {
  return action.type === 'cancel' ? bathroomDraftFromSaved(action.saved) : { ...draft, [action.category]: action.rating };
}

export function completeBathroomDraft(draft: BathroomDraft): draft is BathroomScores {
  return [draft.cleanliness, draft.accessibility, draft.wait_time]
    .every((score) => score !== null && Number.isInteger(score) && score >= 1 && score <= 5);
}

export function crowdDraftReducer(
  level: CrowdLevel | null,
  action: { type: 'select'; level: CrowdLevel } | { type: 'cancel'; saved: CrowdLevel | null },
): CrowdLevel | null {
  return action.type === 'select' ? action.level : action.saved;
}
