import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';

type PrimaryButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  variant = 'primary',
  disabled = false,
  style,
  accessibilityState,
  ...props
}: PrimaryButtonProps) {
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: theme.layout.buttonMinHeight,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.button,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    textAlign: 'center',
  },
  secondary: {
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.purpleTint,
    borderWidth: 1,
    borderColor: theme.colors.purpleBorder,
  },
  secondaryLabel: { color: theme.colors.purpleText },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
});
