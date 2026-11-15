import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';

import { AppIcon } from './app-icon';

export function PreviewNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <View style={styles.notice}>
      <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notice" onPress={onDismiss} style={styles.close}>
        <AppIcon name="close" size={16} color={theme.colors.purpleLight} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radii.md,
    paddingLeft: theme.spacing.md
  },
  message: {
    flex: 1,
    color: theme.colors.purpleText,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: theme.spacing.sm
  },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
