import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadNativeModule } from './helpers/native-module.mjs';
import * as translation from '../src/localization/translation.ts';
import * as formatting from '../src/localization/formatting.ts';

test('the production language provider always uses English without reading a saved device preference', () => {
  let provided;
  const react = {
    createContext(value) { provided = value; return { Provider: 'Provider' }; },
    useContext() { return provided; },
  };
  const provider = loadNativeModule('src/localization/language-provider.tsx', {
    react,
    './translation': translation,
    './formatting': formatting,
    './language-storage': new Proxy({}, { get() { throw new Error('Must not read old Italian preference'); } }),
  });
  const value = provider.useTranslation();
  assert.equal(value.language, 'en');
  assert.equal(value.ready, true);
  assert.equal(value.t('Profile'), 'Profile');
  assert.equal(value.setLanguage, undefined);
});
