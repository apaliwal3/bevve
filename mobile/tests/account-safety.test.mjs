import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountSafetyStore } from '../src/features/contributions/account-safety-store.ts';
import { accountSafetyRepository } from '../src/features/contributions/account-safety-repository.ts';
import { decodeIncidentReport, decodePublishedSafetySummary } from '../../shared/safety-contracts.ts';
import { userId, otherUserId, barId, at, venue } from './helpers/catalog-fixtures.mjs';

const id = n => `20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const input = { category: 'Theft', description: 'Private synthetic test details', occurred_at: null };
const row = (overrides = {}) => ({ id: id(1), bar_id: barId, reporter_id: userId, ...input, status: 'pending', created_at: at, reviewed_at: null, ...overrides });
const publication = (overrides = {}) => ({ id: id(900), bar_id: barId, summary: 'Separate reviewed public test summary', verification_status: 'moderator_reviewed', published_at: at, ...overrides });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function setup(overrides = {}, owner = userId) {
  let next = 100;
  const repository = { load: async () => [], loadQueue: async () => ({ isModerator: false, queue: [] }), loadPublic: async () => [],
    submit: async (_owner, request) => row({ id: request.id, ...request.input }),
    moderate: async (_owner, request) => row({ id: request.id, status: request.decision, reviewed_at: at }), ...overrides };
  const store = createAccountSafetyStore(owner, repository, () => id(++next));
  store.setCatalog({ status: 'ready', venues: [venue()] }); const stop = store.start();
  return { store, stop };
}
function draft(store, version = 0, description = input.description) {
  store.updateDraft(barId, { type: 'category', category: 'Theft' }, version);
  store.updateDraft(barId, { type: 'description', description }, version);
}

test('private incident drafts survive navigation and failed history reads without uploading or borrowing guest data', async () => {
  let fail = true, writes = 0;
  const ui = setup({ load: async () => { if (fail) throw Error('offline'); return []; }, submit: async () => { writes++; } });
  await tick(); draft(ui.store); assert.equal(ui.store.getSnapshot().drafts[barId].description, input.description);
  assert.equal(ui.store.getSnapshot().status, 'error'); assert.deepEqual(ui.store.getSnapshot().history, []);
  await assert.rejects(ui.store.submit(barId, 0), /unavailable/); assert.equal(writes, 0);
  fail = false; await ui.store.refresh(); assert.equal(ui.store.getSnapshot().drafts[barId].description, input.description); ui.stop();
});

test('rapid submissions coalesce, keep private details until confirmation and clear only the confirmed draft', async () => {
  const gate = deferred(); let calls = 0, request;
  const ui = setup({ submit: async (_owner, value) => { calls++; request = value; return gate.promise; } }); await tick(); draft(ui.store);
  const first = ui.store.submit(barId, 0); assert.equal(ui.store.submit(barId, 0), first); assert.equal(calls, 1);
  assert.equal(ui.store.getSnapshot().operations[barId].saved, false); assert.deepEqual(ui.store.getSnapshot().history, []);
  ui.store.updateDraft(barId, { type: 'description', description: 'Attempted edit' }, 0);
  assert.equal(ui.store.getSnapshot().drafts[barId].description, input.description);
  gate.resolve(row({ id: request.id })); await first;
  assert.equal(ui.store.getSnapshot().history.length, 1); assert.equal(ui.store.getSnapshot().operations[barId].saved, true);
  assert.equal(ui.store.getSnapshot().drafts[barId].description, ''); await assert.rejects(ui.store.submit(barId, 0), /Stale/);
  ui.store.updateDraft(barId, { type: 'description', description: 'Stale draft event' }, 0);
  assert.equal(ui.store.getSnapshot().drafts[barId].description, ''); ui.stop();
});

test('uncertain submissions preserve the date, description and request ID across retry and history recovery', async () => {
  let fail = true; const calls = [], history = [];
  const ui = setup({ load: async () => history, submit: async (_owner, request) => {
    calls.push(request); if (fail) throw Error('lost response'); const saved = row({ id: request.id, ...request.input }); history.push(saved); return saved;
  } }); await tick(); draft(ui.store); ui.store.updateDraft(barId, { type: 'date', date: '2020-01-02' }, 0);
  await assert.rejects(ui.store.submit(barId, 0));
  const pending = ui.store.getSnapshot().operations[barId]; assert.equal(pending.error, true);
  assert.equal(ui.store.getSnapshot().drafts[barId].date, '2020-01-02'); assert.ok(pending.request.input.occurred_at);
  fail = false; await ui.store.retry(barId, pending.request.id); assert.deepEqual(calls[0], calls[1]); ui.stop();
  let writes = 0;
  const lost = setup({ load: async () => history, submit: async (_owner, request) => { writes++; history.push(row({ id: request.id, ...request.input })); throw Error('lost'); } });
  await tick(); draft(lost.store); await assert.rejects(lost.store.submit(barId, 0)); await lost.store.refresh();
  assert.equal(lost.store.getSnapshot().operations[barId].saved, true); assert.equal(lost.store.getSnapshot().drafts[barId].description, ''); assert.equal(writes, 1); lost.stop();
});

test('explicit new reports append private history and restore after restart without retaining drafts or merging another account', async () => {
  const history = [];
  const ui = setup({ load: async () => [...history], submit: async (_owner, request) => { const saved = row({ id: request.id, ...request.input }); history.push(saved); return saved; } });
  await tick(); draft(ui.store); await ui.store.submit(barId, 0); draft(ui.store, 1, 'Second private test report'); await ui.store.submit(barId, 1);
  assert.equal(ui.store.getSnapshot().history.length, 2); assert.notEqual(history[0].id, history[1].id); ui.stop();
  const restarted = setup({ load: async () => history }); await tick(); assert.equal(restarted.store.getSnapshot().history.length, 2);
  assert.deepEqual(restarted.store.getSnapshot().drafts, {}); assert.deepEqual(restarted.store.getSnapshot().operations, {}); restarted.stop();
  const other = setup({}, otherUserId); await tick(); assert.deepEqual(other.store.getSnapshot().history, []); assert.deepEqual(other.store.getSnapshot().drafts, {}); other.stop();
});

test('invalid dates and empty descriptions do not write; reporting needs no saved impression but must use a database venue', async () => {
  let writes = 0; const ui = setup({ submit: async () => { writes++; } }); await tick();
  await assert.rejects(ui.store.submit(barId, 0), /Invalid/); draft(ui.store);
  ui.store.updateDraft(barId, { type: 'date', date: '2020-02-31' }, 0); await assert.rejects(ui.store.submit(barId, 0), /Invalid/);
  await assert.rejects(ui.store.submit(id(99), 0), /unavailable/); assert.equal(writes, 0);
  ui.store.setCatalog({ status: 'loading', venues: [venue()] }); await assert.rejects(ui.store.submit(barId, 0), /unavailable/); ui.stop();
});

test('stale history and queue reads cannot overwrite a newly confirmed report or review', async () => {
  const history = deferred(), queue = deferred(); let loads = 0, queueLoads = 0;
  const ui = setup({ load: async () => ++loads === 2 ? history.promise : [],
    loadQueue: async () => ++queueLoads === 2 ? queue.promise : { isModerator: true, queue: [row()] } }); await tick();
  const read = ui.store.refresh(), queueRead = ui.store.refreshQueue();
  draft(ui.store); await ui.store.submit(barId, 0); ui.store.updateReviewDraft(id(1), 'Separate public summary'); await ui.store.moderate(id(1), 'approved');
  history.resolve([]); queue.resolve({ isModerator: true, queue: [row()] }); await Promise.all([read, queueRead]);
  assert.equal(ui.store.getSnapshot().history.length, 2);
  assert.equal(ui.store.getSnapshot().history.find(item => item.id === id(1)).status, 'approved');
  assert.ok(!ui.store.getSnapshot().queue.some(item => item.id === id(1))); ui.stop();
});

test('publications load independently from private history failures and never accept raw private fields', async () => {
  const ui = setup({ load: async () => { throw Error('private history unavailable'); },
    loadPublic: async () => [publication({ reporter_id: userId, report_id: id(1), description: input.description })] });
  await tick(); await ui.store.refreshPublic(barId);
  assert.equal(ui.store.getSnapshot().status, 'error'); const publicState = ui.store.getSnapshot().publicByVenue[barId];
  assert.equal(publicState.status, 'ready'); assert.equal(publicState.rows[0].summary, publication().summary);
  for (const key of ['reporter_id', 'report_id', 'description', 'reviewed_by']) assert.ok(!Object.hasOwn(publicState.rows[0], key)); ui.stop();
});

test('public read errors distinguish unavailable information from a real empty result and retain last loaded summaries', async () => {
  let fail = true, rows = [];
  const ui = setup({ loadPublic: async () => { if (fail) throw Error('offline'); return rows; } }); await tick();
  await ui.store.refreshPublic(barId); assert.equal(ui.store.getSnapshot().publicByVenue[barId].status, 'error');
  fail = false; await ui.store.refreshPublic(barId); assert.equal(ui.store.getSnapshot().publicByVenue[barId].status, 'ready');
  assert.deepEqual(ui.store.getSnapshot().publicByVenue[barId].rows, []);
  rows = [publication()]; await ui.store.refreshPublic(barId); fail = true; await ui.store.refreshPublic(barId);
  assert.equal(ui.store.getSnapshot().publicByVenue[barId].rows.length, 1); assert.equal(ui.store.getSnapshot().publicByVenue[barId].error, true); ui.stop();
});

test('a child publication read before provider startup is registered and runs when the account starts', async () => {
  let calls = 0;
  const store = createAccountSafetyStore(userId, { load: async () => [], loadQueue: async () => ({ isModerator: false, queue: [] }), loadPublic: async () => { calls++; return []; } }, () => id(1));
  await store.refreshPublic(barId); assert.equal(calls, 0); const stop = store.start(); await tick();
  assert.ok(calls >= 1); assert.equal(store.getSnapshot().publicByVenue[barId].status, 'ready'); stop();
});

test('publication invalidation queues another read when moderator approval overlaps an older read', async () => {
  const gate = deferred(); let calls = 0;
  const ui = setup({ loadQueue: async () => ({ isModerator: true, queue: [row({ reporter_id: otherUserId })] }),
    moderate: async (_owner, request) => row({ reporter_id: otherUserId, status: request.decision, reviewed_at: at }),
    loadPublic: async () => ++calls === 1 ? gate.promise : [publication()] }); await tick();
  const read = ui.store.refreshPublic(barId); ui.store.updateReviewDraft(id(1), publication().summary); await ui.store.moderate(id(1), 'approved');
  assert.deepEqual(ui.store.getSnapshot().history, []); gate.resolve([]); await read; await tick();
  assert.equal(calls, 2); assert.equal(ui.store.getSnapshot().publicByVenue[barId].rows[0].summary, publication().summary); ui.stop();
});

test('approval requires a separate summary and uncertain review retries keep the exact decision and summary', async () => {
  let fail = true, calls = [];
  const ui = setup({ loadQueue: async () => ({ isModerator: true, queue: [row()] }),
    moderate: async (_owner, request) => { calls.push(request); if (fail) throw Error('lost'); return row({ status: request.decision, reviewed_at: at }); } }); await tick();
  assert.equal(ui.store.getSnapshot().reviews[id(1)], undefined); await assert.rejects(ui.store.moderate(id(1), 'approved'), /Invalid public summary/);
  assert.equal(calls.length, 0); ui.store.updateReviewDraft(id(1), '  Separate public summary  ');
  await assert.rejects(ui.store.moderate(id(1), 'approved')); ui.store.updateReviewDraft(id(1), 'Changed text');
  const op = ui.store.getSnapshot().reviews[id(1)]; assert.equal(op.request.summary, 'Separate public summary'); assert.equal(op.draft, '  Separate public summary  ');
  await assert.rejects(ui.store.moderate(id(1), 'rejected'), /same review/); fail = false; await ui.store.moderate(id(1), 'approved');
  assert.deepEqual(calls[0], calls[1]); assert.equal(ui.store.getSnapshot().history[0].status, 'approved'); assert.deepEqual(ui.store.getSnapshot().queue, []); ui.stop();
});

test('rapid review taps coalesce and rejection sends no public text even if a summary draft exists', async () => {
  const gate = deferred(); let calls = [], request;
  const ui = setup({ loadQueue: async () => ({ isModerator: true, queue: [row()] }),
    moderate: async (_owner, value) => { calls.push(value); request = value; return gate.promise; } }); await tick();
  ui.store.updateReviewDraft(id(1), 'Unpublished draft'); const first = ui.store.moderate(id(1), 'rejected');
  assert.equal(ui.store.moderate(id(1), 'rejected'), first); assert.equal(calls.length, 1); assert.equal(request.summary, null);
  gate.resolve(row({ status: 'rejected', reviewed_at: at })); await first; assert.deepEqual(ui.store.getSnapshot().publicByVenue, {}); ui.stop();
});

test('ordinary accounts and unavailable moderator roles cannot review and role failures do not hide own reports', async () => {
  const ui = setup({ load: async () => [row()], loadQueue: async () => { throw Error('role unavailable'); } }); await tick();
  assert.equal(ui.store.getSnapshot().status, 'ready'); assert.equal(ui.store.getSnapshot().queueError, true);
  await assert.rejects(ui.store.moderate(id(1), 'rejected'), /unavailable/); ui.stop();
});

test('late history, role, public reads and submissions cannot populate another account after sign-out', async () => {
  const history = deferred(), role = deferred(), publicRead = deferred();
  const ui = setup({ load: () => history.promise, loadQueue: () => role.promise, loadPublic: () => publicRead.promise });
  const read = ui.store.refreshPublic(barId); ui.stop(); history.resolve([row()]); role.resolve({ isModerator: true, queue: [row()] }); publicRead.resolve([publication()]);
  await read; await tick(); assert.deepEqual(ui.store.getSnapshot().history, []); assert.deepEqual(ui.store.getSnapshot().queue, []);
  assert.deepEqual(ui.store.getSnapshot().publicByVenue[barId].rows, []);
  const gate = deferred(); let request, calls = 0;
  const writer = setup({ submit: async (_owner, value) => { request = value; if (++calls === 1) return gate.promise; return row({ id: value.id, ...value.input }); } });
  await tick(); draft(writer.store); const save = writer.store.submit(barId, 0); writer.stop(); const end = writer.store.start(); await tick();
  gate.resolve(row({ id: request.id })); await assert.rejects(save, /Account changed/);
  assert.equal(writer.store.getSnapshot().operations[barId].saving, false); assert.equal(writer.store.getSnapshot().drafts[barId].description, input.description);
  await writer.store.retry(barId, request.id); assert.equal(writer.store.getSnapshot().history.length, 1); end();
});

test('runtime safety decoders reject foreign owners, invalid statuses and times and preserve legacy categories and anonymous reporters', () => {
  assert.throws(() => decodeIncidentReport(row({ reporter_id: otherUserId }), userId));
  assert.throws(() => decodeIncidentReport(row({ status: 'approved' }), userId));
  assert.throws(() => decodeIncidentReport(row({ occurred_at: 'invalid' }), userId));
  assert.throws(() => decodeIncidentReport(row({ status: ['pending'] }), userId));
  assert.equal(decodeIncidentReport(row({ reporter_id: null, category: 'Legacy category' })).category, 'Legacy category');
  assert.throws(() => decodeIncidentReport(row({ reporter_id: null }), userId));
  for (const changed of [{ id: 'fixture' }, { bar_id: id(99) }, { verification_status: 'unverified' }, { published_at: 'invalid' }]) assert.throws(() => decodePublishedSafetySummary(publication(changed), barId));
});

function transport() {
  let owner = userId, sessionOwner = userId, response = row(), role = true, paginate = false, calls = [];
  const query = { then(resolve, reject) { return Promise.resolve({ data: role, error: null }).then(resolve, reject); },
    setHeader(name, value) { calls.push(['header', name, value]); return query; }, single: async () => ({ data: response, error: null }) };
  const client = { auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }),
    getSession: async () => ({ data: { session: { user: { id: sessionOwner }, access_token: 'test-token' } }, error: null }) },
    rpc(name, args) { calls.push(['rpc', name, args]); return query; },
    from(table) {
      let filter, offset;
      const read = { select(columns) { calls.push(['columns', table, columns]); return read; },
        eq(key, value) { filter = [key, value]; return read; }, order() { return read; }, range(start) { offset = start; return read; }, setHeader() { return read; },
        then(resolve, reject) { calls.push(['read', table, filter, offset]);
          return Promise.resolve({ data: Array.from({ length: paginate ? offset === 0 ? 500 : 1 : 1 }, (_, n) => ({ ...(table === 'published_incidents' ? publication() : response), id: id(offset + n + 1) })), error: null }).then(resolve, reject);
        } }; return read;
    } };
  return { client, calls, owner(value) { owner = value; sessionOwner = value; }, sessionOwner(value) { sessionOwner = value; },
    response(value) { response = value; }, role(value) { role = value; }, paginate() { paginate = true; } };
}

test('repository paginates private history, queue and publications and explicitly filters moderator personal history', async () => {
  const mock = transport(); mock.paginate(); const repository = accountSafetyRepository(mock.client);
  assert.equal((await repository.load(userId)).length, 501);
  assert.ok(mock.calls.some(call => call[0] === 'read' && call[2][0] === 'reporter_id' && call[2][1] === userId && call[3] === 500));
  mock.response(row({ reporter_id: otherUserId })); await assert.rejects(repository.load(userId), /Invalid private incident/);
  const queue = await repository.loadQueue(userId); assert.equal(queue.isModerator, true); assert.equal(queue.queue.length, 501);
  assert.ok(mock.calls.some(call => call[0] === 'read' && call[2][0] === 'status' && call[2][1] === 'pending'));
  assert.equal((await repository.loadPublic(barId)).length, 501);
  const columns = mock.calls.find(call => call[0] === 'columns' && call[1] === 'published_incidents')[2];
  for (const field of ['description', 'report_id', 'reporter_id', 'reviewed_by']) assert.ok(!columns.split(',').includes(field));
  mock.role(false); assert.deepEqual(await repository.loadQueue(userId), { isModerator: false, queue: [] });
});

test('repository pins account tokens, sends stable requests without client status/time and rejects mismatched responses or changed accounts', async () => {
  const mock = transport(), repository = accountSafetyRepository(mock.client), request = { id: id(1), barId, input };
  await repository.submit(userId, request); assert.ok(mock.calls.some(call => call[0] === 'header' && call[2] === 'Bearer test-token'));
  const payload = mock.calls.find(call => call[1] === 'submit_incident_report')[2];
  assert.deepEqual(payload, { p_request_id: id(1), p_bar_id: barId, p_category: input.category, p_description: input.description, p_occurred_at: null });
  mock.response(row({ status: 'approved', reviewed_at: at })); await repository.moderate(userId, { id: id(1), decision: 'approved', summary: publication().summary });
  await assert.rejects(repository.moderate(userId, { id: id(2), decision: 'approved', summary: publication().summary }), /Mismatched/);
  mock.response(row({ description: 'Different private details' })); await assert.rejects(repository.submit(userId, request), /Mismatched/);
  mock.sessionOwner(otherUserId); await assert.rejects(repository.submit(userId, request), /Account changed/);
  mock.owner(otherUserId); await assert.rejects(repository.moderate(userId, { id: id(1), decision: 'rejected', summary: null }), /Account changed/);
});
