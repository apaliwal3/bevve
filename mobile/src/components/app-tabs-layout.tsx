import { Link, usePathname } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BevveTheme as theme } from '@/constants/theme';

import { AppIcon, type AppIconName } from './app-icon';
import { PreviewNotice } from './preview-notice';

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
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.root}>
      {notice && (
        <View style={styles.notice}>
          <PreviewNotice message={notice} onDismiss={() => setNotice(null)} />
        </View>
      )}
      <View
        accessibilityLabel="Main navigation"
        style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) }]}>
        <Link href="/explore" asChild>
          <NavButton label="Explore" icon="explore" isFocused={pathname === '/explore'} onPress={() => setNotice(null)} />
        </Link>
        <Link href="/compare" asChild>
          <NavButton label="Compare" icon="compare" isFocused={pathname === '/compare'} onPress={() => setNotice(null)} />
        </Link>
        <NavButton label="Rankings" icon="rankings" accessibilityHint="Coming soon" onPress={() => setNotice('Your personal rankings are coming soon.')} />
        <NavButton label="Profile" icon="profile" accessibilityHint="Coming soon" onPress={() => setNotice('Your profile is coming soon.')} />
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
  notice: {
    width: '100%',
    maxWidth: theme.layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm
  },
  pressed: {
    opacity: 0.7
  }
});
