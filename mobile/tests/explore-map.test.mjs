import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogMapPins, demoMapPins, mapSelection } from '../src/features/explore/venue-map-data.ts';
import { venueMapHtml } from '../src/features/explore/venue-map-html.ts';
import { mockVenues } from '../src/fixtures/venues.ts';
import { filterVenues } from '../src/features/explore/filter-venues.ts';
import { createTranslator } from '../src/localization/translation.ts';
import { venue } from './helpers/catalog-fixtures.mjs';
import { elements, flattenStyle, loadNativeModule, nativeStub } from './helpers/native-module.mjs';
import { hookHarness } from './helpers/hook-harness.mjs';

const theme = loadNativeModule('src/constants/theme.ts');
const t = createTranslator('en');

test('map pins follow the filtered venue list and explicitly distinguish sample coordinates', () => {
  for (const filter of ['All', 'Nearby', 'Cheap', 'Quiet', 'Popular']) {
    const rows = filterVenues(mockVenues, '', filter);
    const pins = demoMapPins(rows);
    assert.deepEqual(pins.map(pin => pin.id), rows.map(row => row.id));
    assert.ok(pins.every(pin => pin.sample));
  }
  assert.deepEqual(demoMapPins(filterVenues(mockVenues, 'missing venue', 'All')), []);
  const rows = [venue({ id: 'real', is_demo: false, latitude: 45.4, longitude: 9.1 }),
    venue({ id: 'sample', is_demo: true }), venue({ latitude: NaN }), venue({ longitude: 181 })];
  const pins = catalogMapPins(rows);
  assert.deepEqual(pins.map(pin => [pin.id, pin.sample]), [['real', false], ['sample', true]]);
  assert.equal(pins[0].latitude, 45.4);
});

test('embedded map messages only open a currently visible bar', () => {
  const pins = demoMapPins(mockVenues.slice(0, 1));
  assert.equal(mapSelection(JSON.stringify({ type: 'venue', id: pins[0].id }), pins), pins[0].id);
  for (const input of ['bad JSON', 'null', '42', '{}', '{"type":"venue","id":"unknown"}',
    JSON.stringify({ type: 'venue', id: mockVenues[1].id }), JSON.stringify({ type: 'other', id: pins[0].id })]) {
    assert.equal(mapSelection(input, pins), null);
  }
});

test('venue names cannot break out of the embedded map script', () => {
  const hostileName = '</script><script>alert("venue")</script><img src=x onerror=alert(1)>';
  const html = venueMapHtml([{ ...demoMapPins(mockVenues)[0], name: hostileName }], {
    title: 'Map', empty: 'No bars', sample: 'Sample', unavailable: 'Unavailable', open: 'Open',
  }, theme.BevveTheme.colors);
  assert.equal(html.includes(hostileName), false);
  assert.ok(html.includes('\\u003c/script\\u003e'));
  assert.ok(html.includes('name.textContent=pin.name'));
  assert.ok(html.includes('OpenStreetMap'));
});

test('the map starts at half height; scrolling expands even an empty list and Show map restores it', () => {
  const hooks = hookHarness(), destinations = [], scrolls = [];
  const { ExploreScreenContainer } = loadNativeModule('src/features/explore/explore-screen-container.tsx', {
    react: hooks.react,
    'react-native': { ...nativeStub, ScrollView: 'ScrollView', RefreshControl: 'RefreshControl' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { router: { push: value => destinations.push(value) } },
    '@/constants/theme': theme,
    '@/components/logo': { Logo: 'Logo' },
    '@/localization/language-provider': { useTranslation: () => ({ t }) },
    './venue-map': { VenueMap: 'VenueMap' },
  });
  const render = () => [...elements(hooks.render(() => ExploreScreenContainer({ pins: [], children: null })))];
  const scroll = nodes => nodes.find(node => node.type === 'ScrollView');
  let nodes = render();
  scroll(nodes).props.onLayout({ nativeEvent: { layout: { height: 800 } } });
  nodes = render();
  const map = nodes.find(node => node.type === 'VenueMap');
  assert.ok(nodes.some(node => node.type === 'View' && flattenStyle(node.props.style).height === 400));
  assert.ok(nodes.some(node => node.type === 'View' && flattenStyle(node.props.style).minHeight === 800));
  scroll(nodes).props.ref.current = { scrollTo: options => scrolls.push(options) };
  nodes.find(node => node.props.accessibilityLabel === 'Expand bar list').props.onPress();
  assert.equal(scrolls[0].y, 400);assert.equal(scrolls[0].animated, true);
  scroll(nodes).props.onScroll({ nativeEvent: { contentOffset: { y: 400 } } });
  nodes = render();
  nodes.find(node => node.props.accessibilityLabel === 'Show map').props.onPress();
  assert.equal(scrolls[1].y, 0);assert.equal(scrolls[1].animated, true);
  scroll(nodes).props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
  assert.ok(!render().some(node => node.props.accessibilityLabel === 'Show map'));
  map.props.onInteractionChange(true);assert.equal(scroll(render()).props.scrollEnabled, false);
  map.props.onInteractionChange(false);assert.equal(scroll(render()).props.scrollEnabled, true);
  map.props.onSelect('bar-id');assert.equal(destinations[0].params.barId, 'bar-id');
  nodes = render();
  scroll(nodes).props.onLayout({ nativeEvent: { layout: { height: 600 } } });
  nodes = render();
  assert.ok(nodes.some(node => node.type === 'View' && flattenStyle(node.props.style).height === 300));
  assert.ok(nodes.some(node => node.type === 'View' && flattenStyle(node.props.style).minHeight === 600));
});
