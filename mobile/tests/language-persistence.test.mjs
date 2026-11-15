import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createLanguageStore, LANGUAGE_STORAGE_KEY } from '../src/localization/language-store.ts';
import { createTranslator } from '../src/localization/translation.ts';
import { languagePreferenceFeedback } from '../src/features/profile/language-preference-feedback.ts';

function storage(saved = null) {
  const values = new Map(saved === null ? [] : [[LANGUAGE_STORAGE_KEY, saved]]);
  const calls = [];
  return {
    values, calls, persistent: true,
    getItem: async (key) => { calls.push(['get', key]); return values.get(key) ?? null; },
    setItem: async (key, value) => { calls.push(['set', key, value]); values.set(key, value); },
  };
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('missing and invalid saved preferences default to English and finish loading', async () => {
  for (const value of [null, '', 'fr', 'IT', '{"language":"it"}']) {
    const store = createLanguageStore(storage(value));
    assert.deepEqual(store.getSnapshot(), { language: 'en', ready: false, saving: false, error: false });
    await store.initialize();
    assert.deepEqual(store.getSnapshot(), { language: 'en', ready: true, saving: false, error: false });
  }
});

test('Italian preference survives a store restart; only the namespaced language enum is persisted', async () => {
  const device = storage();
  const firstLaunch = createLanguageStore(device);
  await firstLaunch.initialize();
  await firstLaunch.select('it');
  const nextLaunch = createLanguageStore(device);
  assert.equal(nextLaunch.getSnapshot().ready, false);
  await nextLaunch.initialize();
  assert.equal(nextLaunch.getSnapshot().language, 'it');
  assert.equal(nextLaunch.getSnapshot().ready, true);
  assert.deepEqual([...device.values], [[LANGUAGE_STORAGE_KEY, 'it']]);
  await nextLaunch.select('en');
  const thirdLaunch = createLanguageStore(device);
  await thirdLaunch.initialize();
  assert.equal(thirdLaunch.getSnapshot().language, 'en');
  assert.ok(device.calls.every((call) => call[1] === LANGUAGE_STORAGE_KEY));
});

test('initialization is idempotent, including React effect replay', async () => {
  const device = storage('it');
  const store = createLanguageStore(device);
  const first = store.initialize();
  assert.equal(first, store.initialize());
  await first;
  await store.initialize();
  assert.equal(device.calls.length, 1);
  assert.equal(store.getSnapshot().language, 'it');
});

test('switching updates subscribers immediately while the device write is pending', async () => {
  const write = deferred();
  const store = createLanguageStore({ ...storage(), setItem: () => write.promise });
  await store.initialize();
  const snapshots = [];
  const unsubscribe = store.subscribe(() => snapshots.push(store.getSnapshot()));
  const result = store.select('it');
  assert.equal(store.getSnapshot().language, 'it');
  assert.equal(store.getSnapshot().saving, true);
  assert.equal(snapshots[0].language, 'it');
  write.resolve();
  await result;
  assert.equal(store.getSnapshot().saving, false);
  assert.equal(snapshots.length, 2);
  unsubscribe();
  await store.select('en');
  assert.equal(snapshots.length, 2);
});

test('rapid switches serialize writes and the final selection wins on reload', async () => {
  const device = storage();
  const firstWrite = deferred();
  let writes = 0;
  const nativeSet = device.setItem;
  device.setItem = async (...args) => {
    if (++writes === 1) await firstWrite.promise;
    return nativeSet(...args);
  };
  const store = createLanguageStore(device);
  await store.initialize();
  const pending = [store.select('it'), store.select('en'), store.select('it')];
  await Promise.resolve();
  assert.equal(writes, 1);
  assert.equal(store.getSnapshot().language, 'it');
  firstWrite.resolve();
  await Promise.all(pending);
  assert.deepEqual(device.calls.filter((call) => call[0] === 'set').map((call) => call[2]), ['it', 'en', 'it']);
  assert.equal(store.getSnapshot().saving, false);
  const reload = createLanguageStore(device);
  await reload.initialize();
  assert.equal(reload.getSnapshot().language, 'it');
});

test('late preference hydration cannot overwrite a new user selection', async () => {
  const read = deferred();
  const store = createLanguageStore({ ...storage(), getItem: () => read.promise });
  const loading = store.initialize();
  await store.select('it');
  read.resolve('en');
  await loading;
  assert.equal(store.getSnapshot().language, 'it');
  assert.equal(store.getSnapshot().ready, true);
});

test('read failures use English without blocking launch and selecting a language recovers', async () => {
  const store = createLanguageStore({ ...storage(), getItem: async () => { throw new Error('Device read failed'); } });
  await store.initialize();
  assert.equal(store.getSnapshot().ready, true);
  assert.equal(store.getSnapshot().language, 'en');
  assert.equal(store.getSnapshot().error, true);
  await store.select('it');
  assert.equal(store.getSnapshot().error, false);
});

test('write failures keep the immediate interface selection and allow a same-language retry', async () => {
  const device = storage('en');
  const setItem = device.setItem;
  let fail = true;
  device.setItem = async (...args) => {
    if (fail) throw new Error('Device write failed');
    return setItem(...args);
  };
  const store = createLanguageStore(device);
  await store.initialize();
  await store.select('it');
  assert.equal(store.getSnapshot().language, 'it');
  assert.equal(store.getSnapshot().error, true);
  assert.equal(store.getSnapshot().saving, false);
  assert.equal(device.values.get(LANGUAGE_STORAGE_KEY), 'en');
  fail = false;
  await store.select('it');
  assert.equal(store.getSnapshot().error, false);
  assert.equal(device.values.get(LANGUAGE_STORAGE_KEY), 'it');
});

test('invalid runtime language input is ignored without writing any application data', async () => {
  const device = storage('it');
  const store = createLanguageStore(device);
  await store.initialize();
  const before = store.getSnapshot();
  await store.select('fr');
  assert.equal(store.getSnapshot(), before);
  assert.equal(device.calls.length, 1);
});

test('Profile shows only error feedback after a failed save, then success after retry, in English and Italian', async () => {
  for (const language of ['en', 'it']) {
    const device = storage(language === 'en' ? 'it' : 'en');
    const setItem = device.setItem;
    const write = deferred();
    let fail = true;
    device.setItem = async (...args) => {
      await write.promise;
      if (fail) throw new Error('Device write failed');
      return setItem(...args);
    };
    const store = createLanguageStore(device);
    await store.initialize();
    const feedback = () => createTranslator(store.getSnapshot().language)(languagePreferenceFeedback({ ...store.getSnapshot(), persistent: store.persistent }));
    const selected = store.select(language);
    assert.equal(feedback(), language === 'it' ? 'Salvataggio della lingua…' : 'Saving language…');
    write.resolve();
    await selected;
    assert.equal(feedback(), language === 'it'
      ? 'Impossibile salvare la lingua. Tocca una lingua per riprovare.'
      : 'Could not save the language. Tap a language to retry.');
    assert.equal(store.getSnapshot().language, language);
    assert.equal(device.values.get(LANGUAGE_STORAGE_KEY), language === 'en' ? 'it' : 'en');

    fail = false;
    const retry = store.select(language);
    assert.equal(feedback(), language === 'it' ? 'Salvataggio della lingua…' : 'Saving language…');
    await retry;
    assert.equal(feedback(), language === 'it' ? 'La lingua viene salvata su questo dispositivo.' : 'Language is saved on this device.');
    assert.equal(store.getSnapshot().language, language);
    assert.equal(device.values.get(LANGUAGE_STORAGE_KEY), language);
  }
});

test('Profile reports browser-session scope without claiming a device save', () => {
  const key = languagePreferenceFeedback({ persistent: false, saving: false, error: false });
  assert.equal(createTranslator('en')(key), 'Language changes last for this browser session only.');
  assert.equal(createTranslator('it')(key), 'La lingua resta selezionata solo per questa sessione del browser.');
});
