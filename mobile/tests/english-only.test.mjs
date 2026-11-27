import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadNativeModule } from './helpers/native-module.mjs';
import * as translation from '../src/localization/translation.ts';
import * as formatting from '../src/localization/formatting.ts';

test('the production provider always uses English and never loads saved Italian preferences', () => {
  let provided;
  const forbidden = new Proxy({}, { get() { throw new Error('Must not load saved Italian preference'); } });
  const provider = loadNativeModule('src/localization/language-provider.tsx', {
    react: {
      createContext(value) { provided = value; return { Provider: 'Provider' }; },
      useContext() { return provided; },
    },
    './translation': translation, './formatting': formatting,
    './language-store': forbidden, './language-storage': forbidden,
  });
  const tree = provider.LanguageProvider({ children: null });
  assert.equal(tree.props.value, provided);
  const value = provider.useTranslation();
  assert.equal(value.language, 'en');
  assert.equal(value.ready, true);
  assert.equal(value.t('Places Been'), 'Places Been');
  assert.equal(value.t('Settings'), 'Settings');
  assert.equal(value.format.currency(650), formatting.createLocaleFormatters('en').currency(650));
  assert.equal(value.setLanguage, undefined);
});
