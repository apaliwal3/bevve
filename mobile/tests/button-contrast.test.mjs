import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import { createTranslator } from '../src/localization/translation.ts';

const require = createRequire(import.meta.url);
// Exercise the real component's style callback without loading a native renderer.
const native = { Pressable: 'Pressable', Text: 'Text', StyleSheet: { create: (styles) => styles }, Platform: { select: (values) => values.ios ?? values.default } };
function load(file, mocks = {}) {
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  runInNewContext(outputText, { module, exports: module.exports, require: (name) => name === 'react-native' ? native : mocks[name] ?? require(name) });
  return module.exports;
}
const themeModule = load('../src/constants/theme.ts');
const { PrimaryButton } = load('../src/components/primary-button.tsx', { '@/constants/theme': themeModule });
const flatten = (styles) => Object.assign({}, ...[styles].flat(Infinity).filter(Boolean));
function composite(color, background) {
  if (color.startsWith('#')) return color.slice(1).match(/../g).map(channel => parseInt(channel, 16));
  const [r, g, b, alpha = 1] = color.match(/[\d.]+/g).map(Number);
  return [r, g, b].map((channel, i) => channel * alpha + background[i] * (1 - alpha));
}
function luminance(rgb) {
  const [r, g, b] = rgb.map((channel) => channel / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (foreground, background, underlay) => {
  const rendered = composite(background, composite(underlay));
  const a = luminance(composite(foreground, rendered)), b = luminance(rendered);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

test('filled buttons retain at least 4.5:1 text contrast in normal, pressed and disabled states in EN/IT', () => {
  for (const language of ['en', 'it']) {
    const label = createTranslator(language)('Save impression and continue');
    for (const [pressed, disabled] of [[false, false], [true, false], [false, true], [true, true]]) {
      const button = PrimaryButton({ label, disabled });
      const container = flatten(button.props.style({ pressed }));
      const text = flatten(button.props.children.props.style);
      assert.equal(container.opacity ?? 1, 1, 'Translucency must not reduce filled-button contrast.');
      for (const underlay of [themeModule.BevveTheme.colors.background, themeModule.BevveTheme.colors.overlaySurface]) {
        assert.ok(contrast(text.color, container.backgroundColor, underlay) >= 4.5);
      }
      assert.equal(button.props.children.props.children, label);
      assert.equal(button.props.disabled, disabled);
      assert.equal(button.props.accessibilityState.disabled, disabled);
    }
  }
});

test('ivory accents and translucent secondary controls use the blue theme', () => {
  const { colors } = themeModule.BevveTheme;
  assert.equal(colors.purple, '#F2EFDF');
  assert.equal(colors.purpleLight, '#F2EFDF');
  assert.equal(colors.onAccent, '#233D60');
  for (const pressed of [false, true]) {
    const button = PrimaryButton({ label: 'Cancel', variant: 'secondary' });
    const container = flatten(button.props.style({ pressed }));
    assert.equal(container.backgroundColor, colors.control);
    assert.equal(container.opacity ?? 1, pressed ? 0.8 : 1);
  }
});
