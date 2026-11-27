import { useTranslation } from '@/localization/language-provider';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BevveTheme as theme } from '@/constants/theme';

import { AppIcon, type AppIconName } from './app-icon';

type NavButtonProps = Omit<ComponentProps<typeof Pressable>, 'children' | 'style'> & {
  label: string;
  icon: AppIconName;
  isFocused?: boolean;
};

function NavButton({ label, icon, isFocused = false, ...props }: NavButtonProps) {
  const color = isFocused ? theme.colors.purpleLight : theme.colors.textMuted;
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
      {isFocused && <View style={styles.activeIndicator} />}
      <AppIcon name={icon} size={21} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const mainTabs = [
  { name: 'explore', label: 'Explore', icon: 'explore' },
  { name: 'rankings', label: 'Rankings', icon: 'rankings' },
  { name: 'profile', label: 'Profile', icon: 'profile' },
] as const;

export default function AppTabsLayout({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.root}>
      <View
        accessibilityRole="tablist"
        accessibilityLabel={t("Main navigation")}
        style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) }]}>
        {mainTabs.map((item) => {
          const route = state.routes.find((candidate) => candidate.name === item.name);
          if (!route) return null;
          const isFocused = state.routes[state.index].key === route.key;
          return (
            <NavButton
              key={route.key}
              label={t(item.label)}
              icon={item.icon}
              isFocused={isFocused}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) navigateToTab(route.key);
              }}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: theme.colors.background
  },
  tabBar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: theme.layout.maxWidth,
    alignSelf: 'center',
    backgroundColor: theme.colors.navigation,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs
  },
  tabLabel: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    textAlign: 'center'
  },
  activeIndicator: {
    position: 'absolute',
    top: -theme.spacing.sm,
    width: 25,
    height: 2,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.purpleLight
  },
  pressed: {
    opacity: 0.7
  }
});
