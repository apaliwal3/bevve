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
        pressed && !disabled && (variant === 'primary' ? styles.primaryPressed : styles.pressed),
        disabled && (variant === 'primary' ? styles.primaryDisabled : styles.disabled),
        style,
      ]}>
      <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel, disabled && variant === 'primary' && styles.primaryDisabledLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: theme.layout.buttonMinHeight,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.button,
    backgroundColor: theme.colors.purpleButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: theme.colors.onAccent,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    textAlign: 'center',
  },
  secondary: {
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.control,
    borderWidth: 1,
    borderColor: theme.colors.purpleBorder,
  },
  secondaryLabel: { color: theme.colors.purpleText },
  primaryPressed: { backgroundColor: theme.colors.purpleButtonPressed },
  primaryDisabled: { backgroundColor: theme.colors.overlaySurface },
  primaryDisabledLabel: { color: theme.colors.text },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
});
