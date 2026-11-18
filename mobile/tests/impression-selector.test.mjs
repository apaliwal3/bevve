import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as impressions from '../src/features/impressions/impression-state.ts';
import { createTranslator } from '../src/localization/translation.ts';
import { elements, flattenStyle, loadNativeModule } from './helpers/native-module.mjs';

const theme = loadNativeModule('src/constants/theme.ts');
function selector(language, value, onChange = () => {}, disabled = false) {
  const component = loadNativeModule('src/features/impressions/impression-selector.tsx', {
    '@/constants/theme': theme, './impression-state': impressions,
    '@/localization/language-provider': { useTranslation: () => ({ t: createTranslator(language) }) },
  });
  const tree = component.ImpressionSelector({ value, onChange, disabled });
  return { tree, radios: [...elements(tree)].filter((node) => node.props.accessibilityRole === 'radio') };
}

test('the compact selector keeps three circular touch targets in equal-width columns on one row in EN/IT', () => {
  let baseline;
  for (const language of ['en', 'it']) {
    const { tree, radios } = selector(language, null);
    assert.equal(tree.props.accessibilityRole, 'radiogroup');
    assert.equal(tree.props.accessibilityLabel, createTranslator(language)('How was it?'));
    const row = flattenStyle(tree.props.style);
    assert.equal(row.flexDirection, 'row');
    assert.equal(radios.length, 3);
    const geometry = radios.map((radio) => {
      const column = flattenStyle(radio.props.style({ pressed: false }));
      const circle = flattenStyle(radio.props.children[0].props.style);
      const label = radio.props.children[1];
      assert.equal(column.flex, 1);
      assert.equal(column.minWidth, 0);
      assert.ok(column.minHeight >= 44 && circle.width >= 44 && circle.height >= 44);
      assert.equal(circle.width, circle.height);
      assert.ok(circle.borderRadius >= circle.width / 2);
      assert.equal(flattenStyle(label.props.style).width, '100%');
      assert.equal(flattenStyle(label.props.style).textAlign, 'center');
      assert.equal(label.props.allowFontScaling, true);
      assert.equal(label.props.numberOfLines, undefined);
      assert.equal(label.props.maxFontSizeMultiplier, undefined);
      assert.equal(flattenStyle(label.props.style).height, undefined);
      return { column, circle, label: flattenStyle(label.props.style) };
    });
    // Fits the narrow content area of a 320pt phone. Native glyph wrapping and
    // Dynamic Type still require the documented physical-device check.
    assert.ok(geometry.reduce((sum, item) => sum + item.circle.width, 0) + row.gap * 2 <= 240);
    if (baseline) assert.deepEqual(geometry, baseline);
    baseline = geometry;
  }
});

test('each impression has its translated label and symbol; checked state also adds a visible badge and outline', () => {
  for (const language of ['en', 'it']) for (const value of impressions.impressionValues) {
    const { radios } = selector(language, value);
    const labels = ['I liked it', 'It was fine', "I didn't like it"].map((key) => createTranslator(language)(key));
    assert.deepEqual(Array.from(radios, (radio) => radio.props.accessibilityLabel), labels);
    radios.forEach((radio, index) => {
      const checked = impressions.impressionValues[index] === value;
      assert.equal(radio.props.accessibilityState.checked, checked);
      const circle = radio.props.children[0];
      assert.equal(circle.props.children[0].props.children, ['✓', '−', '×'][index]);
      assert.equal(Boolean(circle.props.children[1]), checked);
      if (checked) {
        assert.equal(circle.props.children[1].props.children.props.children, '✓');
        assert.ok(flattenStyle(circle.props.style).borderWidth >= 2);
      }
    });
  }
});

test('all three controls emit their stable impression value and disabled controls cannot change it', () => {
  const changes = [];
  const { radios } = selector('en', null, (value) => changes.push(value));
  radios.forEach((radio) => radio.props.onPress());
  assert.deepEqual(changes, ['liked', 'fine', 'disliked']);
  const disabled = selector('it', 'fine', () => assert.fail('Disabled choices must not act.'), true);
  disabled.radios.forEach((radio) => {
    assert.equal(radio.props.disabled, true);
    assert.equal(radio.props.accessibilityState.disabled, true);
    radio.props.onPress();
  });
});
