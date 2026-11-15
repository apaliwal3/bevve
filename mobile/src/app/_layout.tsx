import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { BevveTheme as theme } from '@/constants/theme';
import { VenueRatingsProvider } from '@/features/ratings/venue-ratings-provider';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [theme.fonts.body]: require('@/assets/fonts/DMSans-Regular.ttf'),
    [theme.fonts.bodyBold]: require('@/assets/fonts/DMSans-Bold.ttf'),
    [theme.fonts.heading]: require('@/assets/fonts/Manrope-Bold.ttf'),
    [theme.fonts.brand]: require('@/assets/fonts/Manrope-ExtraBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (fontError) throw fontError;
  if (!fontsLoaded) return null;

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
      <VenueRatingsProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />
      </VenueRatingsProvider>
    </ThemeProvider>
  );
}
