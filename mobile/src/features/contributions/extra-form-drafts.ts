import type { VenueLanguageCode } from '../../fixtures/contribution-catalog.ts';
import { incidentCategories, type IncidentCategory, type ValidationResult } from './venue-extras-state.ts';

export type PriceDraft = { drinkId: string | null; euros: string };
export const emptyPriceDraft: PriceDraft = { drinkId: null, euros: '' };
export function priceDraftReducer(draft: PriceDraft, action:
  | { type: 'select'; drinkId: string; savedCents: number | null; prefilledEuros?: string }
  | { type: 'price'; euros: string }
  | { type: 'cancel' }): PriceDraft {
  switch (action.type) {
    case 'select': return { drinkId: action.drinkId, euros: action.savedCents === null ? '' : action.prefilledEuros ?? (action.savedCents / 100).toFixed(2) };
    case 'price': return { ...draft, euros: action.euros };
    case 'cancel': return emptyPriceDraft;
  }
}

export function languageDraftReducer(draft: readonly VenueLanguageCode[], action:
  | { type: 'select'; code: VenueLanguageCode }
  | { type: 'reset' }): readonly VenueLanguageCode[] {
  if (action.type === 'reset') return [];
  return draft.includes(action.code) ? draft.filter(code => code !== action.code) : [...draft, action.code];
}

export type IncidentDraft = { category: IncidentCategory | null; date: string; description: string };
export const emptyIncidentDraft: IncidentDraft = { category: null, date: '', description: '' };
export type IncidentDraftAction =
  | { type: 'category'; category: IncidentCategory }
  | { type: 'date'; date: string }
  | { type: 'description'; description: string }
  | { type: 'reset' };
export function incidentDraftReducer(draft: IncidentDraft, action: IncidentDraftAction): IncidentDraft {
  switch (action.type) {
    case 'category': return { ...draft, category: action.category };
    case 'date': return { ...draft, date: action.date };
    case 'description': return { ...draft, description: action.description };
    case 'reset': return emptyIncidentDraft;
  }
}

export type IncidentSubmission = { category: IncidentCategory; description: string; occurred_at: string | null };

export function incidentSubmission(draft: IncidentDraft, now = Date.now()): ValidationResult<IncidentSubmission> {
  if (draft.category === null || !incidentCategories.includes(draft.category)) return { ok: false, error: 'Choose an incident category.' };
  const description = draft.description.trim();
  if (!description || description.length > 4000) return { ok: false, error: 'Enter a description (1–4,000 characters).' };
  let occurredAt: string | null = null;
  const input = draft.date.trim();
  if (input) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (!match) return { ok: false, error: 'Use YYYY-MM-DD for the optional date.' };
    const [year, month, day] = match.slice(1).map(Number);
    // A date-only input refers to the user's local calendar day, not UTC midnight.
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    if (year < 1 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getTime() > now) {
      return { ok: false, error: 'Enter a real date that is today or earlier.' };
    }
    occurredAt = date.toISOString();
  }
  return { ok: true, value: { category: draft.category, description, occurred_at: occurredAt } };
}
