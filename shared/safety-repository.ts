import { contributionUuid } from './contribution-contracts.ts';
import { decodeIncidentReport, decodePublishedSafetySummary, matchesIncidentRequest, validIncidentRequest, validIncidentReview,
  type IncidentRequest, type IncidentReview } from './safety-contracts.ts';

const privateColumns = 'id,bar_id,reporter_id,category,description,occurred_at,status,created_at,reviewed_at';
const publicColumns = 'id,bar_id,summary,verification_status,published_at';
type Response = { data: unknown; error: unknown };
type Query = PromiseLike<Response> & {
  eq(column: string, value: string): Query; order(column: string): Query;
  range(start: number, end: number): Query; setHeader(name: string, value: string): Query; single(): PromiseLike<Response>;
};
type SafetyClient = {
  from(table: string): { select(columns: string): Query };
  rpc(name: string, args?: Record<string, unknown>): Query;
  auth: {
    getUser(): PromiseLike<{ data: { user: { id: string } | null }; error: unknown }>;
    getSession(): PromiseLike<{ data: { session: { user: { id: string }; access_token: string } | null }; error: unknown }>;
  };
};
async function pages<T>(read: (offset: number) => Promise<T[]>) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) { const page = await read(offset); rows.push(...page); if (page.length < 500) return rows; }
}
export function createSafetyRepository(transport: unknown) {
  // Decode each response; avoid recursively comparing Supabase generics across packages.
  const client = transport as SafetyClient;
  async function authorization(owner: string) {
    const user = await client.auth.getUser(); if (user.error) throw user.error;
    if (user.data.user?.id !== owner) throw new Error('Account changed');
    const session = await client.auth.getSession(); if (session.error) throw session.error;
    if (session.data.session?.user.id !== owner) throw new Error('Account changed');
    return `Bearer ${session.data.session.access_token}`;
  }
  return {
    load: (owner: string) => pages(async offset => {
      // A moderator's personal history must never accidentally become the queue.
      const { data, error } = await client.from('incident_reports').select(privateColumns).eq('reporter_id', owner)
        .order('created_at').order('id').range(offset, offset + 499);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Invalid private incident history');
      return data.map(row => decodeIncidentReport(row, owner));
    }),
    async loadQueue(owner: string) {
      const header = await authorization(owner);
      const role = await client.rpc('can_moderate_incidents').setHeader('Authorization', header);
      if (role.error) throw role.error;
      if (typeof role.data !== 'boolean') throw new Error('Invalid moderator role');
      if (!role.data) return { isModerator: false, queue: [] };
      const queue = await pages(async offset => {
        const { data, error } = await client.from('incident_reports').select(privateColumns).eq('status', 'pending')
          .order('created_at').order('id').range(offset, offset + 499).setHeader('Authorization', header);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Invalid private incident queue');
        const rows = data.map(row => decodeIncidentReport(row));
        if (rows.some(row => row.status !== 'pending')) throw new Error('Invalid private incident queue');
        return rows;
      });
      return { isModerator: true, queue };
    },
    loadPublic: (barId: string) => {
      if (!contributionUuid(barId)) return Promise.reject(new Error('Invalid venue'));
      return pages(async offset => {
        const { data, error } = await client.from('published_incidents').select(publicColumns).eq('bar_id', barId)
          .order('published_at').order('id').range(offset, offset + 499);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Invalid published safety history');
        return data.map(row => decodePublishedSafetySummary(row, barId));
      });
    },
    async submit(owner: string, request: IncidentRequest) {
      if (!validIncidentRequest(request)) throw new Error('Invalid incident report');
      const header = await authorization(owner);
      const { data, error } = await client.rpc('submit_incident_report', { p_request_id: request.id, p_bar_id: request.barId,
        p_category: request.input.category, p_description: request.input.description, p_occurred_at: request.input.occurred_at })
        .setHeader('Authorization', header).single();
      if (error) throw error;
      const row = decodeIncidentReport(data, owner);
      if (!matchesIncidentRequest(row, request, owner)) throw new Error('Mismatched incident response');
      return row;
    },
    async moderate(owner: string, request: IncidentReview) {
      if (!validIncidentReview(request)) throw new Error('Invalid incident review');
      const header = await authorization(owner);
      const { data, error } = await client.rpc('review_incident_report', {
        p_report_id: request.id, p_decision: request.decision, p_summary: request.summary,
      }).setHeader('Authorization', header).single();
      if (error) throw error;
      const row = decodeIncidentReport(data);
      if (row.id !== request.id || row.status !== request.decision) throw new Error('Mismatched incident review');
      return row;
    },
  };
}
