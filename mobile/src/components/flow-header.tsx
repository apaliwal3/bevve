import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';

import { AppIcon } from './app-icon';
import { Logo } from './logo';

type FlowHeaderProps = { eyebrow: string; title: string; backLabel: string; onBack: () => void };

// Balanced side columns keep the title centered even though the logo is wider than the arrow.
export function FlowHeader({ eyebrow, title, backLabel, onBack }: FlowHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <AppIcon name="back" size={20} color={theme.colors.text} />
        </Pressable>
      </View>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      </View>
      <View style={[styles.side, styles.logo]}><Logo size={19} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  side: {
    width: 64,
    flexShrink: 0
  },
  logo: {
    alignItems: 'flex-end'
  },
  copy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: theme.spacing.xxs
  },
  eyebrow: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    textAlign: 'center'
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 17,
    textAlign: 'center'
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface
  },
  pressed: {
    opacity: 0.7
  }
});
