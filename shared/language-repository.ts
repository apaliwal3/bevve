import { decodeLanguageSuggestion, matchesLanguageRequest, validLanguageRequest,
  type LanguageRequest } from './language-contracts.ts';

const columns = 'id,user_id,bar_id,language_code,status,created_at,reviewed_at';
type Response = { data: unknown; error: unknown };
type Query = PromiseLike<Response> & {
  eq(column: string, value: string): Query; order(column: string): Query;
  range(start: number, end: number): Query; setHeader(name: string, value: string): Query;
  single(): PromiseLike<Response>;
};
// Structural transport keeps shared code independent of either package's node_modules.
type LanguageClient = {
  from(table: string): { select(columns: string): Query };
  rpc(name: string, args?: Record<string, unknown>): Query;
  auth: {
    getUser(): PromiseLike<{ data: { user: { id: string } | null }; error: unknown }>;
    getSession(): PromiseLike<{ data: { session: { user: { id: string }; access_token: string } | null }; error: unknown }>;
  };
};
export function createLanguageRepository(transport: unknown) {
  // Supabase's recursive query generics exceed TS's comparison depth across
  // package versions. Decode all responses at this transport boundary.
  const client = transport as LanguageClient;
  async function authorization(owner: string) {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (data.user?.id !== owner) throw new Error('Account changed');
    const session = await client.auth.getSession();
    if (session.error) throw session.error;
    if (session.data.session?.user.id !== owner) throw new Error('Account changed');
    return `Bearer ${session.data.session.access_token}`;
  }
  return {
    async load(owner: string) {
      const history = [];
      for (let offset = 0; ; offset += 500) {
        // Explicit ownership matters for moderators, whose RLS permits queue reads.
        const { data, error } = await client.from('language_suggestions').select(columns)
          .eq('user_id', owner).order('created_at').order('id').range(offset, offset + 499);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Invalid language history');
        history.push(...data.map(row => decodeLanguageSuggestion(row, owner)));
        if (data.length < 500) return history;
      }
    },
    async loadQueue(owner: string) {
      const header = await authorization(owner);
      const role = await client.rpc('can_moderate_languages').setHeader('Authorization', header);
      if (role.error) throw role.error;
      if (typeof role.data !== 'boolean') throw new Error('Invalid moderator role');
      if (!role.data) return { isModerator: false, queue: [] };
      const queue = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from('language_suggestions').select(columns)
          .eq('status', 'pending').order('created_at').order('id').range(offset, offset + 499)
          .setHeader('Authorization', header);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Invalid language queue');
        const rows = data.map(row => decodeLanguageSuggestion(row));
        if (rows.some(row => row.status !== 'pending')) throw new Error('Invalid language queue');
        queue.push(...rows);
        if (data.length < 500) return { isModerator: true, queue };
      }
    },
    async submit(owner: string, request: LanguageRequest) {
      if (!validLanguageRequest(request)) throw new Error('Invalid language suggestion');
      const header = await authorization(owner);
      const { data, error } = await client.rpc('submit_language_suggestion', {
        p_request_id: request.id, p_bar_id: request.barId, p_language_code: request.code,
      }).setHeader('Authorization', header).single();
      if (error) throw error;
      const row = decodeLanguageSuggestion(data, owner);
      if (!matchesLanguageRequest(row, request, owner)) throw new Error('Mismatched language suggestion');
      return row;
    },
    async moderate(owner: string, id: string, decision: 'approved' | 'rejected') {
      const header = await authorization(owner);
      const { data, error } = await client.rpc('moderate_language_suggestion', {
        p_suggestion_id: id, p_decision: decision,
      }).setHeader('Authorization', header).single();
      if (error) throw error;
      const row = decodeLanguageSuggestion(data);
      if (row.id !== id || row.status !== decision) throw new Error('Mismatched language review');
      return row;
    },
  };
}
