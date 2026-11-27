import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elements, flattenStyle, loadNativeModule } from './helpers/native-module.mjs';
import { hookHarness } from './helpers/hook-harness.mjs';
import { createTranslator, describeFixture } from '../src/localization/translation.ts';
import { createLocaleFormatters } from '../src/localization/formatting.ts';
import * as venueCopy from '../src/localization/venue-copy.ts';
import { aggregateCrowdReports } from '../src/features/contributions/contribution-state.ts';
import { mockVenues, mockVenueDetails } from '../src/fixtures/venues.ts';

const nodes = tree => [...elements(tree)];
const children = node => [node.props.children].flat().filter(value => value && typeof value === 'object');
const text = tree => nodes(tree).filter(node => node.type === 'Text').map(node => node.props.children);

function setup(accountMode = false) {
  const venue = { ...mockVenues[0], name: 'Armani/Bamboo Bar with a longer venue title' };
  const now = Date.parse('2026-11-27T18:00:00Z'), crowd = aggregateCrowdReports([], venue.id, now);
  const harness = hookHarness(), calls = [], t = createTranslator('en');
  const theme = loadNativeModule('src/constants/theme.ts');
  const account = accountMode ? { isDemo: false, crowd, bathrooms: null, community: { status: 'empty', count: 0 }, ownImpression: null, drinks: [] } : undefined;
  const module = loadNativeModule('src/features/venues/bar-details-screen.tsx', {
    react: harness.react, 'expo-image': { Image: 'Image' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    '@/constants/theme': theme,
    '@/localization/language-provider': { useTranslation: () => ({ t, format: createLocaleFormatters('en'), describe: value => describeFixture(value, t) }) },
    '@/components/app-icon': { AppIcon: 'AppIcon' }, '@/components/crowd-meter': { CrowdMeter: 'CrowdMeter' },
    '@/components/primary-button': { PrimaryButton: 'PrimaryButton' }, '@/components/screen-container': { ScreenContainer: 'ScreenContainer' },
    '@/features/saved-bars/bookmark-button': { BookmarkButton: 'BookmarkButton' },
    '@/features/ratings/venue-rating-overlay': { VenueRatingOverlay: 'VenueRatingOverlay' },
    '@/features/ratings/venue-ratings-provider': {
      useVenueContributions: () => ({ crowdSummary: crowd, bathroomSummary: null, ownBathroomReview: null, now }),
      useVenueExtras: () => ({ drinks: [], pendingLanguages: [] }),
    },
    '@/features/comparisons/personal-comparisons-provider': { useVenueOpinion: () => ({ community: { status: 'unavailable' }, ownImpression: null }) },
    '@/features/impressions/community-opinion-summary': { CommunityOpinionSummary: 'CommunityOpinionSummary' },
    '@/features/impressions/impression-selector': { impressionLabels: {} },
    '@/localization/venue-copy': venueCopy, '@/features/contributions/contribution-state': { crowdClassificationLabels: {} },
  });
  return { venue, calls, colors: theme.BevveTheme.colors, render(details = mockVenueDetails[venue.id]) {
    return harness.render(() => module.BarDetailsScreen({ venue, details, account, onBack: () => calls.push('back'),
      onComparePrices: () => calls.push('prices'), onEditImpression: () => calls.push('edit') }));
  } };
}

test('hours sit to the right of the address in a separate information row below the title and plus, never before the title', () => {
  for (const account of [false, true]) {
    const ui = setup(account);
    const details = { ...mockVenueDetails[ui.venue.id], address: 'Via Alessandro Manzoni 31, Milano — a long street address',
      openingHoursLabel: 'Mon–Thu 18:00–01:00\nFri–Sat 18:00–02:00\nSun closed' };
    const tree = ui.render(details);
    const titleRow = nodes(tree).find(node => node.type === 'View' && children(node).some(child => child.type === 'Text' && child.props.children === ui.venue.name));
    assert.equal(children(titleRow)[0].props.children, ui.venue.name);
    const plus = children(titleRow)[1];
    assert.equal(plus.props.accessibilityLabel, 'Open actions for ' + ui.venue.name);
    const header = nodes(tree).find(node => children(node).includes(titleRow));
    assert.equal(children(header)[0], titleRow);
    assert.equal(children(header).length, 2);
    const info = children(header)[1], [address, hours] = children(info);
    assert.ok(text(address).includes(details.address));
    assert.ok(!text(address).includes(details.openingHoursLabel));
    assert.deepEqual(text(hours), ['Opening hours', details.openingHoursLabel]);
    assert.equal(text(tree).filter(value => value === details.openingHoursLabel).length, 1);
    assert.ok(!nodes(hours).includes(plus));
    assert.equal(flattenStyle(info.props.style).flexDirection, 'row');
    assert.equal(flattenStyle(info.props.style).flexWrap, 'wrap');
    assert.equal(flattenStyle(titleRow.props.style).flexDirection, 'row');
    assert.equal(flattenStyle(plus.props.style({ pressed: false })).flexShrink, 0);
    assert.equal(flattenStyle(hours.props.style).backgroundColor, ui.colors.backgroundDeep);
    assert.equal(flattenStyle(children(hours)[1].props.style).color, ui.colors.text);
    for (const node of [header, titleRow, info, address, hours, ...nodes(hours)]) {
      const style = flattenStyle(node.props.style);
      assert.notEqual(style.position, 'absolute');
      assert.equal(style.height, undefined);
      assert.equal(node.props.numberOfLines, undefined);
    }
    for (const column of [address, hours]) {
      const style = flattenStyle(column.props.style);
      assert.ok(style.flexGrow > 0 && style.flexShrink > 0 && style.flexBasis > 0);
      assert.equal(style.minWidth, 0);
    }
    assert.equal(nodes(tree).find(node => node.type === 'Image').props.source, ui.venue.image);
    assert.ok(nodes(tree).some(node => node.type === 'BookmarkButton' && node.props.barId === ui.venue.id));
    assert.deepEqual(ui.calls, []);
  }
});

test('missing or blank hours show an honest missing-data state without inventing a schedule', () => {
  const ui = setup(true);
  for (const openingHoursLabel of [null, undefined, '', '   ']) {
    const tree = ui.render({ ...mockVenueDetails[ui.venue.id], openingHoursLabel });
    assert.equal(text(tree).filter(value => value === 'Opening hours unavailable').length, 1);
  }
  assert.ok(text(ui.render(null)).includes('Opening hours unavailable'));
});

test('the relocated header retains Back, plus, bookmarks, prices and guest-overlay behavior', () => {
  for (const account of [false, true]) {
    const ui = setup(account), tree = ui.render();
    nodes(tree).find(node => node.props.accessibilityLabel === 'Back to Explore').props.onPress();
    nodes(tree).find(node => node.props.accessibilityLabel === 'Compare drink prices').props.onPress();
    nodes(tree).find(node => node.props.accessibilityLabel === 'Open actions for ' + ui.venue.name).props.onPress();
    assert.deepEqual(ui.calls, account ? ['back', 'prices', 'edit'] : ['back', 'prices']);
    assert.equal(nodes(ui.render()).some(node => node.type === 'VenueRatingOverlay'), !account);
  }
});
