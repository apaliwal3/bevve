import { contributionUuid } from './contribution-contracts.ts';

// Venue-language vocabulary; independent from the English-only interface.
export const languageCatalog = [
  { code: 'en', name: 'English' }, { code: 'it', name: 'Italian' },
  { code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' }, { code: 'pt', name: 'Portuguese' },
  { code: 'ar', name: 'Arabic' }, { code: 'ja', name: 'Japanese' },
] as const;
export type VenueLanguageCode = typeof languageCatalog[number]['code'];
export type LanguageSuggestion = {
  id: string; user_id: string; bar_id: string; language_code: VenueLanguageCode;
  status: 'pending' | 'approved' | 'rejected'; created_at: string; reviewed_at: string | null;
};
export type LanguageRequest = { id: string; barId: string; code: VenueLanguageCode };
export const validLanguageCode = (code: unknown): code is VenueLanguageCode => languageCatalog.some(row => row.code === code);
export const validLanguageRequest = (value: LanguageRequest) => contributionUuid(value.id) && contributionUuid(value.barId) && validLanguageCode(value.code);
const time = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function decodeLanguageSuggestion(value: unknown, owner?: string): LanguageSuggestion {
  if (!value || typeof value !== 'object') throw new Error('Invalid language suggestion');
  const row = value as Record<string, unknown>;
  if (!contributionUuid(row.id) || !contributionUuid(row.user_id) || (owner !== undefined && row.user_id !== owner) ||
    !contributionUuid(row.bar_id) || !validLanguageCode(row.language_code) ||
    typeof row.status !== 'string' || !['pending', 'approved', 'rejected'].includes(row.status) || !time(row.created_at) ||
    (row.status === 'pending' ? row.reviewed_at !== null : !time(row.reviewed_at) || Date.parse(row.reviewed_at) < Date.parse(row.created_at))) {
    throw new Error('Invalid language suggestion');
  }
  return { id: row.id, user_id: row.user_id, bar_id: row.bar_id, language_code: row.language_code,
    status: row.status as LanguageSuggestion['status'], created_at: row.created_at, reviewed_at: row.reviewed_at as string | null };
}
// Simultaneous requests for the same pending suggestion return its canonical row.
export const matchesLanguageRequest = (row: LanguageSuggestion, request: LanguageRequest, owner: string) =>
  row.user_id === owner && row.bar_id === request.barId && row.language_code === request.code;
