export type SavedBar = { user_id: string; bar_id: string; created_at: string };
export const savedBarId = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function decodeSavedBar(value: unknown, owner: string): SavedBar {
  const row = value as Partial<SavedBar> | null;
  if (!row || !savedBarId(row.user_id) || row.user_id !== owner || !savedBarId(row.bar_id) ||
    typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))) throw new Error('Invalid saved bar response');
  return { user_id: row.user_id, bar_id: row.bar_id, created_at: row.created_at };
}
