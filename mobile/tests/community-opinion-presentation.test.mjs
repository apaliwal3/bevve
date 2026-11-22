import assert from 'node:assert/strict';
import { test } from 'node:test';

import { communityOpinionView } from '../src/features/impressions/community-opinion-presentation.ts';
import { saveVenueImpression, impressionValues } from '../src/features/impressions/impression-state.ts';
import { aggregateCrowdReports, SESSION_USER_ID } from '../src/features/contributions/contribution-state.ts';
import { selectProfileContributions } from '../src/features/profile/profile-activity.ts';
import { selectVenueCrowd } from '../src/features/explore/venue-crowd.ts';
import { mockVenues, mockVenueDetails } from '../src/fixtures/venues.ts';
import { mockDrinkCatalog } from '../src/fixtures/contribution-catalog.ts';
import * as translations from '../src/localization/translation.ts';
import * as venueCopy from '../src/localization/venue-copy.ts';
import { createLocaleFormatters } from '../src/localization/formatting.ts';
import { elements, loadNativeModule } from './helpers/native-module.mjs';

const venue = mockVenues[0];
const time = '2026-11-18T20:00:00.000Z';
// Synthetic genuine-source records exercise the future contract, not demo fixtures.
const record = (number, impression = 'liked', extra = {}) => ({
  user_id: '97c0c196-e3f2-4d15-9c53-' + number.toString(16).padStart(12, '0'),
  bar_id: venue.id, impression, source: 'community', updated_at: time, ...extra,
});

function ui(language, ownImpression = null) {
  const t = translations.createTranslator(language);
  const format = createLocaleFormatters(language);
  const localization = { useTranslation: () => ({ t, format, language, describe: (value) => translations.describeFixture(value, t) }) };
  const theme = loadNativeModule('src/constants/theme.ts');
  const shared = { '@/constants/theme': theme, '@/localization/language-provider': localization };
  const summary = loadNativeModule('src/features/impressions/community-opinion-summary.tsx', shared);
  const selector = loadNativeModule('src/features/impressions/impression-selector.tsx', { ...shared, './impression-state': { impressionValues } });
  const opinion = { community: communityOpinionView(null, venue.id), ownImpression };
  const contributions = {
    useVenueContributions: () => ({
      bathroomSummary: mockVenueDetails[venue.id].bathrooms, crowdSummary: aggregateCrowdReports([], venue.id, Date.parse(time)),
      ownBathroomReview: null, now: Date.parse(time),
    }),
    useVenueCrowdSelector: () => (item) => selectVenueCrowd(item, [], Date.parse(time)),
    useVenueExtras: () => ({ drinks: [], pendingLanguages: [], startingPriceCents: null }),
  };
  const common = {
    ...shared, react: { useState: (initial) => [initial, () => {}] }, 'expo-image': { Image: 'Image' },
    '@/components/app-icon': { AppIcon: 'AppIcon' }, '@/components/crowd-meter': { CrowdMeter: 'CrowdMeter' },
    '@/components/primary-button': { PrimaryButton: 'PrimaryButton' }, '@/components/screen-container': { ScreenContainer: 'ScreenContainer' },
    '@/features/ratings/venue-ratings-provider': contributions,
    '@/features/comparisons/personal-comparisons-provider': { useVenueOpinion: () => opinion },
    '@/features/impressions/community-opinion-summary': summary,
    '@/features/impressions/impression-selector': selector,
  };
  const card = loadNativeModule('src/components/venue-card.tsx', {
    ...common, './app-icon': { AppIcon: 'AppIcon' }, './crowd-meter': { CrowdMeter: 'CrowdMeter' },
  });
  const details = loadNativeModule('src/features/venues/bar-details-screen.tsx', {
    ...common, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    '@/features/ratings/venue-rating-overlay': { VenueRatingOverlay: 'VenueRatingOverlay' },
    '@/localization/venue-copy': venueCopy,
    '@/features/contributions/contribution-state': { crowdClassificationLabels: {} },
  });
  return { t, summary, card, details, common, contributions };
}

const textValues = (tree) => [...elements(tree)].filter((node) => node.type === 'Text').flatMap((node) =>
  [node.props.children].flat().filter((value) => typeof value === 'string' || typeof value === 'number'));

test('presentation distinguishes an absent community source from a genuinely measured zero, including demo-only input', () => {
  assert.deepEqual(communityOpinionView(null, venue.id), { status: 'unavailable' });
  assert.deepEqual(communityOpinionView([], venue.id), { status: 'empty', count: 0 });
  assert.deepEqual(communityOpinionView([record(1, 'liked', { source: 'demo' })], venue.id), { status: 'empty', count: 0 });
});

test('one eligible opinion presents its real 100% or 0% and count without any threshold', () => {
  for (const impression of ['liked', 'fine', 'disliked']) {
    assert.deepEqual(communityOpinionView([record(1, impression)], venue.id), {
      status: 'ready', count: 1, percentage: impression === 'liked' ? 100 : 0,
    });
  }
});

test('display rounds the distinct-user percentage after taking latest edits and retaining all three categories', () => {
  const records = [record(1), record(2), record(3, 'disliked'), record(3, 'fine', { updated_at: '2026-11-18T20:01:00Z' })];
  assert.deepEqual(communityOpinionView(records, venue.id), { status: 'ready', count: 3, percentage: 67 });
  assert.deepEqual(communityOpinionView([...records, record(2, 'disliked', { updated_at: '2026-11-18T20:02:00Z' })], venue.id), {
    status: 'ready', count: 3, percentage: 33,
  });
});

test('English and Italian summaries visibly and accessibly pair every percentage with its opinion count', () => {
  for (const language of ['en', 'it']) {
    const { t, summary } = ui(language);
    for (const [records, percentage, count] of [[[], null, 0], [[record(1)], 100, 1], [[record(1, 'fine')], 0, 1], [[record(1), record(2, 'disliked')], 50, 2]]) {
      const opinion = communityOpinionView(records, venue.id);
      for (const compact of [false, true]) {
        const tree = summary.CommunityOpinionSummary({ opinion, compact });
        assert.equal(tree.props.accessible, true);
        assert.equal(tree.props.accessibilityLabel, percentage === null ? t('No opinions yet') : t('{percentage}% liked it · {count} opinions', { percentage, count }));
        const visible = textValues(tree);
        assert.ok(visible.includes(t('Community opinion')));
        if (count) {
          assert.ok(visible.includes(t('{percentage}% liked it', { percentage })));
          assert.ok(visible.includes(t('{count} opinions', { count })));
        } else assert.ok(visible.includes(t('No opinions yet')));
      }
    }
  }
});

test('Explore cards and Bar Details keep demo impressions separate from unavailable community data and preserve bathroom stars', () => {
  for (const language of ['en', 'it']) for (const ownImpression of [null, 'liked', 'fine', 'disliked']) {
    const { t, summary, card, details } = ui(language, ownImpression);
    const cardTree = card.VenueCard({ venue, onPress() {} });
    const detailsTree = details.BarDetailsScreen({ venue, details: mockVenueDetails[venue.id], onBack() {}, onComparePrices() {} });
    for (const tree of [cardTree, detailsTree]) {
      const opinions = [...elements(tree)].filter((node) => node.type === summary.CommunityOpinionSummary);
      assert.equal(opinions.length, 1);
      assert.equal(opinions[0].props.opinion.status, 'unavailable');
      const content = summary.CommunityOpinionSummary(opinions[0].props);
      assert.equal(content.props.accessibilityLabel, t('Community opinions are unavailable in this demo.'));
      assert.ok(!textValues(content).some((value) => /[%★]/.test(value)));
      assert.ok(!textValues(tree).some((value) => /overall|BAR RATING|VALUTAZIONE BAR/i.test(value)));
    }
    assert.ok(cardTree.props.accessibilityLabel.includes(t('Community opinions are unavailable in this demo.')));
    if (ownImpression) {
      assert.ok(cardTree.props.accessibilityLabel.includes(t('Your impression')));
      assert.ok(textValues(detailsTree).includes(t('Your impression')));
      assert.ok(textValues(detailsTree).includes(t('Demo session only · Separate from community opinions')));
    }
    assert.ok(textValues(cardTree).some((value) => String(value).includes('★')));
    const bathroomTiles = [...elements(detailsTree)].filter((node) => typeof node.type === 'function' && node.type.name === 'BathroomSummary');
    assert.equal(bathroomTiles.length, 3);
    assert.ok(bathroomTiles.every((node) => textValues(node.type(node.props)).some((value) => String(value).includes('★'))));
    assert.ok([...elements(detailsTree)].some((node) => node.props.accessibilityLabel === t('Compare drink prices')));
  }
});

test('Profile renders the current saved impression once, without stars, in both languages', () => {
  for (const language of ['en', 'it']) {
    const { t, common, contributions } = ui(language, 'disliked');
    const first = saveVenueImpression({}, record(1, 'liked', { user_id: SESSION_USER_ID, source: 'demo' }));
    const edited = saveVenueImpression(first, record(1, 'disliked', { user_id: SESSION_USER_ID, source: 'demo', updated_at: '2026-11-18T20:01:00Z' }));
    const activity = selectProfileContributions({ impressions: edited, crowdReports: [], bathroomReviews: [], priceObservations: [] }, SESSION_USER_ID, mockVenues, mockDrinkCatalog);
    const profile = loadNativeModule('src/features/profile/profile-screen.tsx', {
      ...common, '@/components/logo': { Logo: 'Logo' }, '@/fixtures/venues': { exploreMockUser: {} },
      '@/features/auth/account-panel': { AccountPanel: 'AccountPanel' },
      '@/localization/translation': translations, './language-preference-feedback': { languagePreferenceFeedback: () => 'DEMO SESSION' },
      './profile-activity-components': { ProfileActivitySection: 'ActivitySection', ProfileActivityRow: 'ActivityRow' },
      '@/features/comparisons/personal-comparisons-provider': { useSavedImpressions: () => edited, usePersonalRankings: () => ({ entries: [], completedCount: 0 }) },
      '@/features/ratings/venue-ratings-provider': { ...contributions, useProfileContributions: (state) => { assert.equal(state, edited); return activity; } },
    });
    const tree = profile.ProfileScreen({ onOpenVenue() {}, onExplore() {}, onRankings() {}, onWelcome() {} });
    const section = [...elements(tree)].find((node) => node.type === 'ActivitySection' && node.props.title === t('My impressions'));
    assert.equal(section.props.count, 1);
    const rows = [...elements(section)].filter((node) => node.type === 'ActivityRow');
    assert.equal(rows.length, 1);
    assert.ok(rows[0].props.summary.includes(t("I didn't like it")));
    assert.equal(rows[0].props.trailing, undefined);
    assert.ok(!textValues(section).some((value) => String(value).includes('★')));
  }
});
