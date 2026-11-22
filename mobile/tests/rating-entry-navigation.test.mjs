import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTranslator, describeFixture, languages } from '../src/localization/translation.ts';
import { createLocaleFormatters } from '../src/localization/formatting.ts';
import { selectProfileContributions } from '../src/features/profile/profile-activity.ts';
import { SESSION_USER_ID } from '../src/features/contributions/contribution-state.ts';
import { venueFromProfileHref, venueFromRankingsHref } from '../src/features/venues/bar-details-navigation.ts';
import { rankingBadgeSize } from '../src/features/rankings/ranking-summary-layout.ts';
import { exploreMockUser, mockVenues } from '../src/fixtures/venues.ts';
import { elements, loadNativeModule, nativeStub } from './helpers/native-module.mjs';

const theme = loadNativeModule('src/constants/theme.ts');
const guide = 'To add impressions or resume comparisons, open a bar in Explore and tap +.';
const hint = 'Open Explore, choose a bar and tap + to add an impression or resume comparisons.';
const empty = 'Open a bar in Explore and tap + to save your impression. Comparisons with bars you have experienced build your ranking.';

function screens(language, ranked) {
  const t = createTranslator(language);
  const personal = { entries: ranked ? [{ position: 1, venue: mockVenues[0], comparisonCount: 1 }] : [], completedCount: ranked ? 1 : 0 };
  const activity = selectProfileContributions({ impressions: {}, crowdReports: [], bathroomReviews: [], priceObservations: [] }, SESSION_USER_ID, mockVenues, []);
  const mocks = {
    'react-native': { ...nativeStub, useWindowDimensions: () => ({ fontScale: 2, width: 320 }) },
    '@/constants/theme': theme,
    '@/localization/language-provider': { useTranslation: () => ({ t, language, format: createLocaleFormatters(language), describe: (value) => describeFixture(value, t) }) },
    '@/components/app-icon': { AppIcon: 'AppIcon' }, '@/components/logo': { Logo: 'Logo' },
    '@/components/primary-button': { PrimaryButton: 'PrimaryButton' }, '@/components/screen-container': { ScreenContainer: 'ScreenContainer' },
    '@/components/crowd-meter': { CrowdMeter: 'CrowdMeter' }, '@/fixtures/venues': { exploreMockUser },
    '@/features/auth/account-panel': { AccountPanel: 'AccountPanel' },
    '@/features/comparisons/personal-comparisons-provider': { usePersonalRankings: () => personal, useSavedImpressions: () => ({}) },
  };
  const rankings = loadNativeModule('src/features/rankings/personal-rankings-screen.tsx', {
    ...mocks, './ranked-venue-row': { RankedVenueRow: 'RankedVenueRow' }, './ranking-summary-layout': { rankingBadgeSize },
  });
  const profile = loadNativeModule('src/features/profile/profile-screen.tsx', {
    ...mocks, '@/localization/translation': { languages },
    '@/features/impressions/impression-selector': { impressionLabels: {} },
    '@/features/ratings/venue-ratings-provider': { useProfileContributions: () => activity },
    './profile-activity-components': { ProfileActivitySection: 'ActivitySection', ProfileActivityRow: 'ActivityRow' },
    './language-preference-feedback': { languagePreferenceFeedback: () => 'DEMO SESSION' },
  });
  return { t, rankings, profile };
}

for (const screen of ['rankings', 'profile']) test(screen + ' guides users to Explore and + in English and Italian, preserving contextual venue links', () => {
  for (const language of ['en', 'it']) for (const ranked of [false, true]) {
    const { t, rankings, profile } = screens(language, ranked);
    const calls = [];
    const route = loadNativeModule('src/app/(tabs)/' + screen + '.tsx', {
      'expo-router': { router: {
        navigate: (href) => calls.push(['navigate', href]), push: (href) => calls.push(['push', href]), dismissTo: (href) => calls.push(['dismissTo', href]),
      } },
      '@/features/rankings/personal-rankings-screen': rankings, '@/features/profile/profile-screen': profile,
      '@/features/venues/bar-details-navigation': { venueFromRankingsHref, venueFromProfileHref },
    });
    const element = route.default();
    const tree = element.type(element.props);
    const nodes = [...elements(tree)];
    const cta = nodes.find((node) => node.type === 'PrimaryButton' && node.props.label === t('Explore bars'));
    assert.ok(cta);
    assert.equal(cta.props.accessibilityHint, t(hint));
    cta.props.onPress();
    assert.deepEqual(calls, [['navigate', '/explore']]);
    assert.ok(nodes.some((node) => node.type === 'Text' && node.props.children === t(guide)));
    if (!ranked) {
      assert.ok(screen === 'rankings' ? nodes.some((node) => node.props.children === t(empty)) : nodes.some((node) => node.props.emptyHint === t(empty)));
    }
    assert.ok(!nodes.some((node) => node.type === 'PrimaryButton' && /Continue comparing|Start comparing|Compare more bars|Continua a confrontare/.test(node.props.label)));
    calls.length = 0;
    element.props.onOpenVenue(screen === 'rankings' ? mockVenues[0] : mockVenues[0].id);
    assert.deepEqual(calls, [['push', { pathname: '/bars/[barId]', params: { barId: mockVenues[0].id, returnTo: screen } }]]);
  }
});
