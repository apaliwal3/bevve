import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';

type FormInputProps = Omit<TextInputProps, 'style' | 'onFocus' | 'onBlur' | 'value' | 'onChangeText'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  trailing?: ReactNode;
};

export function FormInput({ label, value, onChangeText, error, inputRef, trailing, ...props }: FormInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.focused, error && styles.invalid]}>
        <TextInput
          ref={inputRef}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.purpleLight}
          keyboardAppearance="dark"
          {...props}
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={props.accessibilityLabel ?? label}
          accessibilityHint={error ?? props.accessibilityHint}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />
        {trailing}
      </View>
      {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6
  },
  label: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12
  },
  inputRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface
  },
  focused: {
    borderColor: theme.colors.purpleLight
  },
  invalid: {
    borderColor: theme.colors.errorBorder
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingVertical: theme.spacing.md,
    paddingRight: theme.spacing.sm,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 14
  },
  error: {
    color: theme.colors.error,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 17
  }
});
