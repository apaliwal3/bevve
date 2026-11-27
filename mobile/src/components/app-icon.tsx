import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { BevveTheme as theme } from '@/constants/theme';

const symbols = {
  explore: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  compare: { ios: 'arrow.left.arrow.right', android: 'swap_horiz', web: 'swap_horiz' },
  rankings: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  profile: { ios: 'person.crop.circle', android: 'person', web: 'person' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  crowd: { ios: 'person.2', android: 'group', web: 'group' },
  bathroom: { ios: 'toilet', android: 'wc', web: 'wc' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  photo: { ios: 'photo', android: 'image', web: 'image' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  thumbsUp: { ios: 'hand.thumbsup.fill', android: 'thumb_up', web: 'thumb_up' },
  thumbsDown: { ios: 'hand.thumbsdown.fill', android: 'thumb_down', web: 'thumb_down' },
  languages: { ios: 'globe', android: 'language', web: 'language' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  password: { ios: 'lock', android: 'lock', web: 'lock' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  bookmark: { ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' },
  bookmarkFilled: { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' },
  safety: { ios: 'shield', android: 'shield', web: 'shield' },
} satisfies Record<string, SymbolViewProps['name']>;

export type AppIconName = keyof typeof symbols;

export function AppIcon({
  name,
  size = 20,
  color = theme.colors.textMuted,
}: { name: AppIconName; size?: number; color?: string }) {
  return <SymbolView name={symbols[name]} size={size} tintColor={color} accessible={false} />;
}
