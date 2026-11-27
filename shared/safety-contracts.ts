import { contributionUuid } from './contribution-contracts.ts';

export const incidentCategories = ['Theft', 'Harassment', 'Violence', 'Other'] as const;
export type IncidentCategory = typeof incidentCategories[number];
export type IncidentInput = { category: IncidentCategory; description: string; occurred_at: string | null };
export type IncidentRequest = { id: string; barId: string; input: IncidentInput };
export type IncidentReport = {
  id: string; bar_id: string; reporter_id: string | null; category: string; description: string;
  occurred_at: string | null; status: 'pending' | 'approved' | 'rejected'; created_at: string; reviewed_at: string | null;
};
export type IncidentReview = { id: string; decision: 'approved' | 'rejected'; summary: string | null };
export type PublishedSafetySummary = {
  id: string; bar_id: string; summary: string; verification_status: 'moderator_reviewed'; published_at: string;
};
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
const time = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && [...value].length <= max;
export const sameIncidentTime = (left: string | null, right: string | null) => left === null || right === null
  ? left === right : Date.parse(left) === Date.parse(right);
export const validIncidentInput = (value: IncidentInput) => incidentCategories.some(category => category === value.category) &&
  text(value.description, 4000) && value.description === value.description.trim() &&
  (value.occurred_at === null || time(value.occurred_at) && Date.parse(value.occurred_at) <= Date.now());
export const validIncidentRequest = (value: IncidentRequest) => contributionUuid(value.id) && contributionUuid(value.barId) && validIncidentInput(value.input);
export const validIncidentReview = (value: IncidentReview) => contributionUuid(value.id) && (value.decision === 'approved'
  ? text(value.summary, 1000) && value.summary === value.summary.trim() : value.decision === 'rejected' && value.summary === null);
export function decodeIncidentReport(value: unknown, owner?: string): IncidentReport {
  if (!record(value) || !contributionUuid(value.id) || !contributionUuid(value.bar_id) ||
    !(value.reporter_id === null || contributionUuid(value.reporter_id)) || owner !== undefined && value.reporter_id !== owner ||
    !text(value.category, 80) || !text(value.description, 4000) || !time(value.created_at) ||
    !(value.occurred_at === null || time(value.occurred_at) && Date.parse(value.occurred_at) <= Date.parse(value.created_at)) ||
    typeof value.status !== 'string' || !['pending', 'approved', 'rejected'].includes(value.status) ||
    (value.status === 'pending' ? value.reviewed_at !== null : !time(value.reviewed_at) || Date.parse(value.reviewed_at) < Date.parse(value.created_at))) {
    throw new Error('Invalid private incident report');
  }
  return { id: value.id, bar_id: value.bar_id, reporter_id: value.reporter_id, category: value.category,
    description: value.description, occurred_at: value.occurred_at, status: value.status as IncidentReport['status'],
    created_at: value.created_at, reviewed_at: value.reviewed_at as string | null };
}
export function decodePublishedSafetySummary(value: unknown, barId: string): PublishedSafetySummary {
  if (!record(value) || !contributionUuid(value.id) || value.bar_id !== barId || !text(value.summary, 1000) ||
    value.verification_status !== 'moderator_reviewed' || !time(value.published_at)) throw new Error('Invalid published safety summary');
  // Explicit projection: public state has no private description, reporter or report ID.
  return { id: value.id, bar_id: barId, summary: value.summary, verification_status: 'moderator_reviewed', published_at: value.published_at };
}
export const matchesIncidentRequest = (row: IncidentReport, request: IncidentRequest, owner: string) => row.id === request.id &&
  row.bar_id === request.barId && row.reporter_id === owner && row.category === request.input.category &&
  row.description === request.input.description && sameIncidentTime(row.occurred_at, request.input.occurred_at);
