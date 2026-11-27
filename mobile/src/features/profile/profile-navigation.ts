export const profileDestinations = {
  places: '/places-been', wants: '/want-to-try', edit: '/edit-profile', settings: '/settings', password: '/reset-password',
} as const;

type ProfileNavigator = { canGoBack: () => boolean; back: () => void; replace: (href: '/profile') => void };
export function backToProfile(navigation: ProfileNavigator) {
  if (navigation.canGoBack()) navigation.back();
  else navigation.replace('/profile');
}
