import { StyleSheet, View } from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';
import { useTranslation } from '@/localization/language-provider';

export function CrowdMeter({ level }: { level: number }) {
  const { t } = useTranslation();
  return (
    <View accessible accessibilityLabel={t('Crowd level {level} out of 5', { level })} style={styles.meter}>
      {[1, 2, 3, 4, 5].map((step) => (
        <View key={step} style={[styles.bar, { height: 4 + step * 2 }, step <= level && styles.active]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  meter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 15
  },
  bar: {
    width: 4,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceRaised
  },
  active: {
    backgroundColor: theme.colors.purpleLight
  }
});
