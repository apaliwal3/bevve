import { usePathname } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BevveTheme as theme } from '@/constants/theme';

import { AppIcon, type AppIconName } from './app-icon';
import { PreviewNotice } from './preview-notice';

// Use Pressable's rendered-element ref type rather than Router's View component ref type.
type NavButtonProps = Omit<TabTriggerSlotProps, 'ref' | 'children'> &
  Pick<ComponentProps<typeof Pressable>, 'ref'> & { label: string; icon: AppIconName };

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
  const isWelcome = pathname === '/';

  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.content} />
      {!isWelcome && notice && (
        <View style={styles.notice}>
          <PreviewNotice message={notice} onDismiss={() => setNotice(null)} />
        </View>
      )}
      <TabList
        accessibilityLabel="Main navigation"
        style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) }, isWelcome && styles.hidden]}>
        <TabTrigger name="welcome" href="/" style={styles.hidden} />
        <TabTrigger name="explore" href="/explore" onPress={() => setNotice(null)} asChild>
          <NavButton label="Explore" icon="explore" />
        </TabTrigger>
        <NavButton label="Compare" icon="compare" accessibilityHint="Coming soon" onPress={() => setNotice('Pairwise comparisons are coming soon.')} />
        <NavButton label="Rankings" icon="rankings" accessibilityHint="Coming soon" onPress={() => setNotice('Your personal rankings are coming soon.')} />
        <NavButton label="Profile" icon="profile" accessibilityHint="Coming soon" onPress={() => setNotice('Your profile is coming soon.')} />
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    flex: 1
  },
  hidden: {
    display: 'none'
  },
  tabBar: {
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
