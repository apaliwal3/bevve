import { loadNativeModule, nativeStub } from './native-module.mjs';
import { createTranslator } from '../../src/localization/translation.ts';
import { createLocaleFormatters } from '../../src/localization/formatting.ts';
import * as comparisons from '../../src/features/comparisons/comparison-state.ts';
import * as feed from '../../src/features/profile/profile-feed.ts';
import * as identity from '../../src/features/profile/profile-identity.ts';
import * as navigation from '../../src/features/profile/profile-navigation.ts';
import * as venueNavigation from '../../src/features/venues/bar-details-navigation.ts';
import { authErrorMessage } from '../../src/features/auth/auth-store.ts';

export function profileUi(language = 'en', options = {}) {
  const calls = [];
  const t = createTranslator(language), format = createLocaleFormatters(language);
  const auth = { session: null, signOut: async () => calls.push('signOut'), ...options.auth };
  const profile = { demo: !auth.session, username: null, loading: false, error: false, retry: () => calls.push('retry'), ...options.identity };
  const router = { push: href => calls.push(['push', href]), dismissTo: href => calls.push(['dismissTo', href]), replace: href => calls.push(['replace', href]), back: () => calls.push('back'), canGoBack: () => options.canGoBack ?? true };
  const savedBars = { status: 'ready', bars: {}, operations: {}, refreshing: false, error: false, refresh: async () => calls.push('saved bars'), ...options.savedBars };
  const state = []; let cursor = 0;
  const mocks = {
    react: { useMemo: fn => fn(), useRef: value => ({ current: value }), useState: initial => {
      const index = cursor++; if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    } },
    'expo-router': { router }, 'react-native': { ...nativeStub, FlatList: 'FlatList' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, 'expo-image': { Image: 'Image' },
    '@/constants/theme': loadNativeModule('src/constants/theme.ts'),
    '@/components/app-icon': { AppIcon: 'AppIcon' }, '@/components/primary-button': { PrimaryButton: 'PrimaryButton' },
    '@/components/flow-header': { FlowHeader: 'FlowHeader' }, '@/components/screen-container': { ScreenContainer: 'ScreenContainer' },
    '@/localization/language-provider': { useTranslation: () => ({ t, format, language }) },
    '@/features/auth/auth-provider': { useAuth: () => auth }, '@/features/auth/auth-store': { authErrorMessage },
    './use-profile-identity': { useProfileIdentity: () => profile }, '@/features/profile/use-profile-identity': { useProfileIdentity: () => profile },
    '@/features/comparisons/comparison-state': comparisons,
    '@/features/saved-bars/saved-bars-provider': { useSavedBars: () => savedBars },
    './saved-bars-feedback': { SavedBarsFeedback: 'SavedBarsFeedback' },
    '@/features/saved-bars/bookmark-button': { BookmarkButton: 'BookmarkButton' },
    './profile-identity': identity, './profile-feed': feed, './profile-list': { ProfileList: 'ProfileList' },
    './profile-navigation': navigation, '@/features/profile/profile-navigation': navigation, '@/features/profile/profile-identity': identity, '@/features/venues/bar-details-navigation': venueNavigation,
    '@/features/profile/profile-secondary-screen': { ProfileSecondaryScreen: 'ProfileSecondaryScreen' },
  };
  const rows = loadNativeModule('src/features/profile/profile-activity-components.tsx', mocks);
  mocks['./profile-activity-components'] = rows; mocks['@/features/profile/profile-activity-components'] = rows;
  const view = loadNativeModule('src/features/profile/profile-view.tsx', mocks);
  return { calls, auth, profile, savedBars, t, format, mocks, rows, render(props) { cursor = 0; return view.ProfileView(props); } };
}
