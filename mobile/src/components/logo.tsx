import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';

type LogoProps = { size?: number; style?: StyleProp<TextStyle> };

export function Logo({ size = 25, style }: LogoProps) {
  return (
    <Text accessibilityLabel="bevve" style={[styles.logo, { fontSize: size }, style]}>
      bevve<Text style={styles.dot}>.</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  logo: { fontFamily: theme.fonts.brand, color: theme.colors.text, letterSpacing: -1.4 },
  dot: { color: theme.colors.purpleLight },
});
