import { useTranslation } from '@/localization/language-provider';
import { Link, usePathname } from 'expo-router';
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

export default function AppTabsLayout() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.root}>
      <View
        accessibilityLabel={t("Main navigation")}
        style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) }]}>
        <Link href="/explore" asChild>
          <NavButton label={t("Explore")} icon="explore" isFocused={pathname === '/explore'} />
        </Link>
        <Link href="/compare" asChild>
          <NavButton label={t("Compare")} icon="compare" isFocused={pathname === '/compare'} />
        </Link>
        <Link href="/rankings" asChild>
          <NavButton label={t("Rankings")} icon="rankings" isFocused={pathname === '/rankings'} />
        </Link>
        <Link href="/profile" asChild>
          <NavButton label={t("Profile")} icon="profile" isFocused={pathname === '/profile'} />
        </Link>
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
    backgroundColor: theme.colors.background,
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
