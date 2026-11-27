import type { selectProfileContributions, ProfileVenue } from './profile-activity.ts';
import type { Translate } from '../../localization/translation.ts';
import type { createLocaleFormatters } from '../../localization/formatting.ts';
import { crowdLevelKeys } from '../../localization/venue-copy.ts';

export type ProfileActivity = ReturnType<typeof selectProfileContributions>;
type Entry<K extends keyof ProfileActivity> = ProfileActivity[K] extends (infer T)[] ? T : never;
export type FeedItem =
  | { id: string; kind: 'impression'; venue: ProfileVenue; at: string; entry: Entry<'impressions'> }
  | { id: string; kind: 'crowd'; venue: ProfileVenue; at: string; entry: Entry<'crowds'> }
  | { id: string; kind: 'bathroom'; venue: ProfileVenue; at: string; entry: Entry<'bathrooms'> }
  | { id: string; kind: 'price'; venue: ProfileVenue; at: string; entry: Entry<'prices'> };

export const profileImpressionLabels = { liked: 'Liked', fine: 'Fine', disliked: 'Disliked' } as const;
const impressionActions = { liked: 'You liked {name}', fine: 'You thought {name} was fine', disliked: 'You disliked {name}' } as const;

// Project only the four explicitly safe categories. No generic spreading of records
// or moderation/private inputs into this presentation contract.
export function selectProfileFeed(activity: ProfileActivity): FeedItem[] {
  const feed: FeedItem[] = [
    ...activity.impressions.map(entry => ({ id: 'impression:' + entry.venue.id, kind: 'impression' as const, venue: entry.venue, at: entry.updatedAt, entry })),
    ...activity.crowds.map(entry => ({ id: 'crowd:' + entry.id, kind: 'crowd' as const, venue: entry.venue, at: entry.submittedAt, entry })),
    ...activity.bathrooms.map(entry => ({ id: 'bathroom:' + entry.venue.id, kind: 'bathroom' as const, venue: entry.venue, at: entry.updatedAt, entry })),
    ...activity.prices.map(entry => ({ id: 'price:' + entry.id, kind: 'price' as const, venue: entry.venue, at: entry.observedAt, entry })),
  ];
  const time = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : -Infinity;
  return feed.sort((a, b) => {
    const left = time(a.at), right = time(b.at);
    return (left === right ? 0 : left > right ? -1 : 1) || a.id.localeCompare(b.id);
  });
}

export function profileFeedCopy(item: FeedItem, t: Translate, format: ReturnType<typeof createLocaleFormatters>) {
  const name = item.venue.available ? item.venue.name : t('Venue unavailable');
  const actions = {
    bathroom: 'You reviewed the bathrooms at {name}', price: 'You updated a drink price at {name}', crowd: 'You reported crowd levels at {name}',
  } as const;
  const action = item.kind === 'impression' ? impressionActions[item.entry.impression] : actions[item.kind];
  const title = t(action, { name });
  let summary: string;
  switch (item.kind) {
    case 'impression': summary = t('Your impression: {impression}', { impression: t(profileImpressionLabels[item.entry.impression]) }); break;
    case 'crowd': summary = t('Crowd: {level}', { level: t(crowdLevelKeys[item.entry.level]) }); break;
    case 'bathroom': {
      const score = (value: number | null) => value === null ? t('Unavailable') : t('{score}/5', { score: format.number(value) });
      summary = t('Cleanliness: {clean} · Accessibility: {access} · Waiting: {wait}', {
        clean: score(item.entry.cleanliness), access: score(item.entry.accessibility), wait: score(item.entry.waitTime),
      }); break;
    }
    case 'price': summary = t('{drink} · {price}', { drink: item.entry.servingMl === null ? t('Drink unavailable')
      : t('{name} · {volume} ml', { name: item.entry.drinkName, volume: format.number(item.entry.servingMl) }), price: format.currency(item.entry.priceCents) }); break;
  }
  return { title, summary, date: Number.isFinite(Date.parse(item.at)) ? format.dateTime(item.at) : null };
}
