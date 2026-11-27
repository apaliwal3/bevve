import { SavedBarsProvider } from '@/features/saved-bars/saved-bars-provider';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { BevveTheme as theme } from '@/constants/theme';
import { VenueRatingsProvider } from '@/features/ratings/venue-ratings-provider';
import { PersonalComparisonsProvider } from '@/features/comparisons/personal-comparisons-provider';
import { LanguageProvider, useTranslation } from '@/localization/language-provider';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { VenueCatalogProvider } from '@/features/catalog/catalog-provider';
import { AccountComparisonsProvider } from '@/features/comparisons/account-comparisons-provider';
import { AccountContributionsProvider } from '@/features/contributions/account-contributions-provider';
import { AccountLanguagesProvider } from '@/features/contributions/account-languages-provider';
import { AccountSafetyProvider } from '@/features/contributions/account-safety-provider';
import { AccountLocationProvider } from '@/features/location/account-location-provider';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  return <LanguageProvider><AuthProvider><AppLayout /></AuthProvider></LanguageProvider>;
}

function AppLayout() {
  const { ready } = useTranslation();
  const auth = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    [theme.fonts.body]: require('@/assets/fonts/DMSans-Regular.ttf'),
    [theme.fonts.bodyBold]: require('@/assets/fonts/DMSans-Bold.ttf'),
    [theme.fonts.heading]: require('@/assets/fonts/Manrope-Bold.ttf'),
    [theme.fonts.brand]: require('@/assets/fonts/Manrope-ExtraBold.ttf'),
  });

  useEffect(() => {
    if (ready && auth.ready && (fontsLoaded || fontError)) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError, ready, auth.ready]);

  if (fontError) throw fontError;
  if (!fontsLoaded || !ready || !auth.ready) return null;

  return (
    <ThemeProvider
      value={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.colors.background,
          card: theme.colors.surface,
          text: theme.colors.text,
          primary: theme.colors.purple,
          border: theme.colors.border,
        },
      }}>
      <StatusBar style="light" />
      <VenueCatalogProvider>
        <SavedBarsProvider>
          <AccountLocationProvider>
            <AccountSafetyProvider>
              <AccountLanguagesProvider>
                <AccountContributionsProvider>
                  <AccountComparisonsProvider>
                    <VenueRatingsProvider key={auth.session?.user.id ?? 'demo'}>
                      <PersonalComparisonsProvider>
                        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />
                      </PersonalComparisonsProvider>
                    </VenueRatingsProvider>
                  </AccountComparisonsProvider>
                </AccountContributionsProvider>
              </AccountLanguagesProvider>
            </AccountSafetyProvider>
          </AccountLocationProvider>
        </SavedBarsProvider>
      </VenueCatalogProvider>
    </ThemeProvider>
  );
}
