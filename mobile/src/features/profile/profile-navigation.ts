export const profileDestinations = {
  places: '/places-been', wants: '/want-to-try', password: '/change-password', settings: '/settings',
} as const;

type ProfileNavigator = { canGoBack: () => boolean; back: () => void; replace: (href: '/profile' | '/settings') => void };
function navigateBack(navigation: ProfileNavigator, fallback: '/profile' | '/settings') {
  if (navigation.canGoBack()) navigation.back();
  else navigation.replace(fallback);
}
export function backToProfile(navigation: ProfileNavigator) { navigateBack(navigation, '/profile'); }
export function backToSettings(navigation: ProfileNavigator) { navigateBack(navigation, '/settings'); }
