import { Tabs } from 'expo-router/js-tabs';

import AppTabs from '@/components/app-tabs';
import { BevveTheme as theme } from '@/constants/theme';
import { useTranslation } from '@/localization/language-provider';

export default function MainTabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      backBehavior="none"
      screenOptions={{ headerShown: false, animation: 'none', lazy: true, freezeOnBlur: false, sceneStyle: { backgroundColor: theme.colors.background } }}
      tabBar={(props) => <AppTabs {...props} />}>
      <Tabs.Screen name="explore" options={{ title: t('Explore') }} />
      <Tabs.Screen name="compare" options={{ title: t('Personal bar comparisons') }} />
      <Tabs.Screen name="rankings" options={{ title: t('My Rankings') }} />
      <Tabs.Screen name="profile" options={{ title: t('Demo profile') }} />
    </Tabs>
  );
}
