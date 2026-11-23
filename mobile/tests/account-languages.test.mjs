import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountLanguageStore } from '../src/features/contributions/account-language-store.ts';
import { accountLanguageRepository } from '../src/features/contributions/account-language-repository.ts';
import { decodeLanguageSuggestion } from '../../shared/language-contracts.ts';
import { userId, otherUserId, barId, at, venue } from './helpers/catalog-fixtures.mjs';

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const row = (overrides = {}) => ({ id: id(1), user_id: userId, bar_id: barId, language_code: 'it', status: 'pending', created_at: at, reviewed_at: null, ...overrides });
const catalog = { status: 'ready', venues: [venue()] };
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function setup(overrides = {}, owner = userId) {
  let next = 100, invalidations = 0;
  const repository = { load: async () => [], loadQueue: async () => ({ isModerator: false, queue: [] }),
    submit: async (_owner, request) => row({ id: request.id, language_code: request.code }), moderate: async () => { throw Error('unused'); }, ...overrides };
  const store = createAccountLanguageStore(owner, repository, () => id(++next), () => invalidations++);
  store.setCatalog(catalog); const stop = store.start();
  return { store, stop, get invalidations() { return invalidations; } };
}

test('language failures stay separate from other contributions and retain no fixture suggestions', async () => {
  let fail = true;
  const ui = setup({ load: async () => { if (fail) throw Error('migration unavailable'); return []; } });
  await tick(); assert.equal(ui.store.getSnapshot().status, 'error'); assert.deepEqual(ui.store.getSnapshot().history, []);
  await assert.rejects(ui.store.submit(barId, 'it', 0), /unavailable/);
  fail = false; await ui.store.refresh(); assert.equal(ui.store.getSnapshot().status, 'ready'); ui.stop();
});

test('rapid language submissions coalesce, preserve pending details, and show success only after confirmation', async () => {
  const gate = deferred(); let calls = 0, request;
  const ui = setup({ submit: async (_owner, value) => { calls++; request = value; return gate.promise; } }); await tick();
  const before = ui.invalidations, first = ui.store.submit(barId, 'it', 0);
  assert.equal(ui.store.submit(barId, 'it', 0), first); assert.equal(calls, 1);
  assert.deepEqual(ui.store.getSnapshot().history, []); assert.equal(ui.store.getSnapshot().operations[barId].saved, false);
  await assert.rejects(ui.store.submit(barId, 'fr', 0), /pending suggestion/);
  gate.resolve(row({ id: request.id })); await first;
  assert.equal(ui.store.getSnapshot().history.length, 1); assert.equal(ui.store.getSnapshot().operations[barId].saved, true);
  assert.equal(ui.invalidations, before + 1); await assert.rejects(ui.store.submit(barId, 'fr', 0), /Stale/); ui.stop();
});

test('uncertain suggestion retries reuse one request and reconcile committed rows from history', async () => {
  const saved = []; let fail = true, calls = [];
  const ui = setup({ load: async () => saved, submit: async (_owner, request) => {
    calls.push(request); if (fail) throw Error('lost response'); const result = row({ id: request.id }); saved.push(result); return result;
  } }); await tick(); await assert.rejects(ui.store.submit(barId, 'it', 0));
  const op = ui.store.getSnapshot().operations[barId]; assert.equal(op.error, true); assert.equal(op.request.code, 'it');
  fail = false; await ui.store.retry(barId, op.request.id); assert.deepEqual(calls[0], calls[1]);
  ui.stop(); const restarted = setup({ load: async () => saved }); await tick();
  assert.equal(restarted.store.getSnapshot().history.length, 1); assert.deepEqual(restarted.store.getSnapshot().operations, {}); restarted.stop();
  let writes = 0;
  const lost = setup({ load: async () => saved, submit: async (_owner, request) => { writes++; saved.push(row({ id: request.id, language_code: request.code })); throw Error('lost'); } });
  await tick(); await assert.rejects(lost.store.submit(barId, 'fr', 0)); await lost.store.refresh();
  assert.equal(lost.store.getSnapshot().operations[barId].saved, true); assert.equal(writes, 1); lost.stop();
});

test('canonical pending rows from another device are accepted and kept as one history entry', async () => {
  const ui = setup({ submit: async () => row({ id: id(999) }) }); await tick();
  await ui.store.submit(barId, 'it', 0); assert.equal(ui.store.getSnapshot().history[0].id, id(999));
  await assert.rejects(ui.store.submit(barId, 'it', 1), /already associated or pending/); ui.stop();
});

test('unknown venues, approved languages, pending duplicates and unsupported language codes cannot submit', async () => {
  let writes = 0;
  const ui = setup({ load: async () => [row()], submit: async () => { writes++; } }); await tick();
  ui.store.setCatalog({ status: 'ready', venues: [venue({ languages: [{ code: 'en' }] })] });
  for (const [bar, code] of [[id(99), 'fr'], [barId, 'xx'], [barId, 'en'], [barId, 'it']]) await assert.rejects(ui.store.submit(bar, code, 0));
  assert.equal(writes, 0); ui.stop();
});

test('refreshes preserve submissions and moderator decisions confirmed after a read began', async () => {
  const stale = deferred(), queue = deferred(); let loads = 0, queueLoads = 0;
  const ui = setup({ load: async () => ++loads === 2 ? stale.promise : [],
    loadQueue: async () => ++queueLoads === 2 ? queue.promise : ({ isModerator: true, queue: [row({ id: id(3), user_id: otherUserId, language_code: 'fr' })] }),
    moderate: async (_owner, requestId, decision) => row({ id: requestId, user_id: otherUserId, language_code: 'fr', status: decision, reviewed_at: at }),
  }); await tick();
  const read = ui.store.refresh(), queueRead = ui.store.refreshQueue();
  await ui.store.submit(barId, 'it', 0); await ui.store.moderate(id(3), 'approved');
  stale.resolve([]); queue.resolve({ isModerator: true, queue: [row({ id: id(3), user_id: otherUserId, language_code: 'fr' })] });
  await Promise.all([read, queueRead]);
  assert.equal(ui.store.getSnapshot().history.length, 1); assert.ok(!ui.store.getSnapshot().queue.some(item => item.id === id(3))); ui.stop();
});

test('moderator history changes arriving later replace stale pending status', async () => {
  let history = [row()]; const ui = setup({ load: async () => history }); await tick();
  history = [row({ status: 'approved', reviewed_at: at })]; await ui.store.refresh();
  assert.equal(ui.store.getSnapshot().history[0].status, 'approved'); ui.stop();
});

test('moderation errors preserve the selected decision and retries never switch the action', async () => {
  let fail = true, calls = [];
  const ui = setup({ loadQueue: async () => ({ isModerator: true, queue: [row()] }),
    moderate: async (_owner, requestId, decision) => { calls.push([requestId, decision]); if (fail) throw Error('lost'); return row({ status: decision, reviewed_at: at }); } });
  await tick(); await assert.rejects(ui.store.moderate(id(1), 'approved'));
  assert.deepEqual(ui.store.getSnapshot().reviews[id(1)], { decision: 'approved', saving: false, error: true });
  await assert.rejects(ui.store.moderate(id(1), 'rejected'), /pending decision/);
  fail = false; await ui.store.moderate(id(1), 'approved'); assert.deepEqual(calls, [[id(1), 'approved'], [id(1), 'approved']]);
  assert.deepEqual(ui.store.getSnapshot().queue, []); assert.equal(ui.store.getSnapshot().history[0].status, 'approved'); ui.stop();
});

test('ordinary accounts and unavailable roles cannot moderate; queue errors do not hide own history', async () => {
  const ui = setup({ load: async () => [row()], loadQueue: async () => { throw Error('role unavailable'); } }); await tick();
  assert.equal(ui.store.getSnapshot().status, 'ready'); assert.equal(ui.store.getSnapshot().queueError, true);
  assert.equal(ui.store.getSnapshot().isModerator, false); await assert.rejects(ui.store.moderate(id(1), 'approved'), /unavailable/); ui.stop();
});

test('account changes ignore late language writes and effect replay keeps uncertain requests retryable', async () => {
  const gate = deferred(); let request, count = 0;
  const ui = setup({ submit: async (_owner, value) => { request = value; if (++count === 1) return gate.promise; return row({ id: value.id }); } }); await tick();
  const save = ui.store.submit(barId, 'it', 0); ui.stop(); const stop = ui.store.start(); await tick();
  gate.resolve(row({ id: request.id })); await assert.rejects(save, /Account changed/);
  assert.equal(ui.store.getSnapshot().operations[barId].saving, false); await ui.store.retry(barId, request.id); stop();
  const other = setup({}, otherUserId); await tick(); assert.deepEqual(other.store.getSnapshot().history, []); other.stop();
});

test('late history and role reads cannot populate a store after sign-out', async () => {
  const history = deferred(), role = deferred();
  const ui = setup({ load: () => history.promise, loadQueue: () => role.promise });
  ui.stop(); history.resolve([row()]); role.resolve({ isModerator: true, queue: [row({ user_id: otherUserId })] });
  await tick(); assert.deepEqual(ui.store.getSnapshot().history, []); assert.deepEqual(ui.store.getSnapshot().queue, []);
  assert.equal(ui.store.getSnapshot().isModerator, false);
});

test('foreign owners, mismatched languages and invalid status responses cannot enter account state', async () => {
  for (const value of [row({ user_id: otherUserId }), row({ language_code: 'fr' }), row({ status: 'approved', reviewed_at: null })]) {
    const ui = setup({ submit: async () => value }); await tick();
    await assert.rejects(ui.store.submit(barId, 'it', 0)); assert.deepEqual(ui.store.getSnapshot().history, []); ui.stop();
  }
  assert.throws(() => decodeLanguageSuggestion(row({ reviewed_at: at })));
  assert.throws(() => decodeLanguageSuggestion(row({ created_at: 'invalid' })));
  assert.throws(() => decodeLanguageSuggestion(row({ status: ['pending'] })));
});

function transport() {
  let owner = userId, response = row(), role = true, calls = [], pages = false;
  const query = { then(resolve, reject) { return Promise.resolve({ data: role, error: null }).then(resolve, reject); },
    setHeader(name, value) { calls.push(['header', name, value]); return query; },
    async single() { return { data: response, error: null }; } };
  const client = { auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }),
    getSession: async () => ({ data: { session: { user: { id: owner }, access_token: 'test-token' } }, error: null }) },
    rpc(name, args) { calls.push(['rpc', name, args]); return query; },
    from(table) {
      let filter, offset;
      const read = { select(columns) { assert.ok(!columns.includes('reviewed_by')); return read; },
        eq(key, value) { filter = [key, value]; calls.push(['filter', key, value]); return read; },
        order() { return read; }, range(start) { offset = start; return read; }, setHeader() { return read; },
        then(resolve, reject) {
          calls.push(['read', table, filter, offset]);
          const length = pages ? offset === 0 ? 500 : 1 : 1;
          return Promise.resolve({ data: Array.from({ length }, (_, n) => ({ ...response, id: id(offset + n + 1) })), error: null }).then(resolve, reject);
        } };
      return read;
    } };
  return { client, calls, setOwner(value) { owner = value; }, setResponse(value) { response = value; }, setRole(value) { role = value; }, paginate() { pages = true; } };
}

test('repository explicitly scopes moderator own-history reads and paginates history and queue beyond 500', async () => {
  const mock = transport(); mock.paginate(); const repository = accountLanguageRepository(mock.client);
  assert.equal((await repository.load(userId)).length, 501);
  assert.ok(mock.calls.some(call => call[0] === 'filter' && call[1] === 'user_id' && call[2] === userId));
  mock.setResponse(row({ user_id: otherUserId })); await assert.rejects(repository.load(userId), /Invalid language/);
  const queue = await repository.loadQueue(userId); assert.equal(queue.isModerator, true); assert.equal(queue.queue.length, 501);
  assert.ok(mock.calls.some(call => call[0] === 'filter' && call[1] === 'status' && call[2] === 'pending'));
  mock.setRole(false); assert.deepEqual(await repository.loadQueue(userId), { isModerator: false, queue: [] });
});

test('repository writes pin account tokens, preserve request IDs and reject mismatched responses', async () => {
  const mock = transport(), repository = accountLanguageRepository(mock.client), request = { id: id(1), barId, code: 'it' };
  await repository.submit(userId, request);
  assert.ok(mock.calls.some(call => call[0] === 'header' && call[2] === 'Bearer test-token'));
  assert.deepEqual(mock.calls.find(call => call[1] === 'submit_language_suggestion')[2], { p_request_id: id(1), p_bar_id: barId, p_language_code: 'it' });
  mock.setResponse(row({ status: 'approved', reviewed_at: at })); await repository.moderate(userId, id(1), 'approved');
  await assert.rejects(repository.moderate(userId, id(2), 'approved'), /Mismatched/);
  mock.setResponse(row({ language_code: 'fr' })); await assert.rejects(repository.submit(userId, request), /Mismatched/);
  mock.setOwner(otherUserId); await assert.rejects(repository.submit(userId, request), /Account changed/);
  await assert.rejects(repository.moderate(userId, id(1), 'approved'), /Account changed/);
});
