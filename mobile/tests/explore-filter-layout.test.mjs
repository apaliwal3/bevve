import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EXPLORE_HORIZONTAL_PADDING, filterChipLayout } from '../src/features/explore/filter-layout.ts';
import * as filters from '../src/features/explore/filter-venues.ts';
import { selectVenueCrowd } from '../src/features/explore/venue-crowd.ts';
import * as fixtures from '../src/fixtures/venues.ts';
import * as mapData from '../src/features/explore/venue-map-data.ts';
import { createTranslator } from '../src/localization/translation.ts';
import { elements, flattenStyle, loadNativeModule, nativeStub } from './helpers/native-module.mjs';

const theme = loadNativeModule('src/constants/theme.ts');
function explore(language) {
  const { DemoExploreScreen: Screen } = loadNativeModule('src/app/(tabs)/explore.tsx', {
    '@/features/catalog/catalog-provider': { useVenueCatalog: () => ({ mode: 'demo' }) },
    '@/features/catalog/account-explore-screen': { AccountExploreScreen: 'AccountExploreScreen' },
    react: { useState: (value) => [value, () => {}], useMemo: (factory) => factory() },
    'react-native': { ...nativeStub, ScrollView: 'ScrollView' },
    'expo-router': { Link: 'Link', router: {} },
    '@/localization/language-provider': { useTranslation: () => ({ t: createTranslator(language) }) },
    '@/constants/theme': theme,
    '@/components/app-icon': { AppIcon: 'AppIcon' },
    '@/components/logo': { Logo: 'Logo' },
    '@/features/explore/explore-screen-container': { ExploreScreenContainer: 'ScreenContainer' },
    '@/features/explore/venue-map-data': mapData,
    '@/components/venue-card': { VenueCard: 'VenueCard' },
    '@/features/explore/filter-venues': filters,
    '@/features/explore/filter-layout': { EXPLORE_HORIZONTAL_PADDING, filterChipLayout },
    '@/fixtures/venues': fixtures,
    '@/features/ratings/venue-ratings-provider': {
      usePriceComparisonSelection: () => ({ drinkId: null }),
      useVenueCrowdSelector: () => selectVenueCrowd,
      useVenuePriceCatalog: (venues) => venues,
    },
    '@/features/prices/price-navigation': {},
  });
  return [...elements(Screen())];
}

test('all five Explore chips use one horizontally scrollable row in EN/IT', () => {
  for (const language of ['en', 'it']) {
    const tree = explore(language);
    const container = tree.find((node) => node.type === 'ScrollView' && node.props.horizontal === true);
    assert.ok(container);
    assert.equal(container.props.showsHorizontalScrollIndicator, false);
    assert.equal(container.props.keyboardShouldPersistTaps, 'handled');
    const rowStyle = flattenStyle(container.props.contentContainerStyle);
    assert.equal(rowStyle.flexDirection, 'row');
    assert.equal(rowStyle.flexWrap, 'nowrap');
    assert.equal(rowStyle.gap, 8);
    assert.equal(container.props.children.length, 5);
    assert.deepEqual(container.props.children.map((chip) => [...elements(chip)].find((node) => node.type === 'Text').props.children),
      language === 'en' ? ['All', 'Nearby', 'Cheap', 'Quiet', 'Popular'] : ['Tutti', 'Vicini', 'Economici', 'Tranquilli', 'Popolari']);
  }
});

test('filter pills fit their labels with original padding, typography and touch height in both languages', () => {
  let englishStyles;
  for (const language of ['en', 'it']) {
    const chips = explore(language).filter((node) => node.type === 'Pressable' && node.props.accessibilityState?.selected !== undefined);
    const styles = chips.map((chip) => {
      const style = flattenStyle(chip.props.style({ pressed: false }));
      assert.equal(style.width, undefined);
      assert.equal(style.minWidth, undefined);
      assert.equal(style.flex, undefined);
      assert.equal(style.flexBasis, undefined);
      assert.equal(style.flexGrow, undefined);
      assert.equal(style.flexShrink, 0);
      assert.equal(style.minHeight, 44);
      assert.equal(style.paddingHorizontal, 13);
      const label = [...elements(chip)].find((node) => node.type === 'Text');
      assert.equal(flattenStyle(label.props.style).fontSize, 12);
      assert.notEqual(label.props.allowFontScaling, false);
      assert.equal(label.props.maxFontSizeMultiplier, undefined);
      return style;
    });
    if (language === 'en') englishStyles = styles;
    else {
      assert.deepEqual(styles, englishStyles);
    }
  }
});
