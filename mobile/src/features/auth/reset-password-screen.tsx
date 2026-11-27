import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { FormInput } from '@/components/form-input';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { ProfileSecondaryScreen } from '@/features/profile/profile-secondary-screen';
import { backToProfile } from '@/features/profile/profile-navigation';
import { useTranslation } from '@/localization/language-provider';
import { validatePasswordReset, type PasswordResetErrors, type PasswordResetValues } from '../../../../shared/password-reset';
import { useAuth } from './auth-provider';
import { authErrorMessage } from './auth-store';

const emptyValues = (): PasswordResetValues => ({ currentPassword: '', newPassword: '', confirmPassword: '' });

export function ResetPasswordScreen() {
  const auth = useAuth();
  // Remount on account changes so a previous account's draft cannot survive.
  return <PasswordForm key={auth.session?.user.id ?? 'guest'} />;
}

function PasswordForm() {
  const auth = useAuth();
  const { t } = useTranslation();
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState<PasswordResetErrors>({});
  const [error, setError] = useState<ReturnType<typeof authErrorMessage> | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [visible, setVisible] = useState(false);
  const pending = useRef(false);
  const attempt = useRef(0);
  const newPassword = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmation = useRef<ComponentRef<typeof TextInput>>(null);
  const submitting = status === 'submitting';

  useFocusEffect(useCallback(() => () => {
    attempt.current++;
    setValues(emptyValues());
    setErrors({});
    setError(null);
    setVisible(false);
    setStatus('idle');
    // Keep an in-flight mutation locked if this route is focused again.
    Keyboard.dismiss();
  }, []));

  function change(field: keyof PasswordResetValues, value: string) {
    if (pending.current) return;
    setValues(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
    setError(null);
  }

  async function submit() {
    if (pending.current || status !== 'idle' || !auth.session) return;
    const nextErrors = validatePasswordReset(values);
    setErrors(nextErrors);
    setError(null);
    if (Object.keys(nextErrors).length) return;
    pending.current = true;
    const request = ++attempt.current;
    setStatus('submitting');
    setVisible(false);
    Keyboard.dismiss();
    try {
      await auth.resetPassword(values);
      if (attempt.current !== request) return;
      setValues(emptyValues());
      setStatus('success');
    } catch (failure) {
      if (attempt.current !== request) return;
      setError(authErrorMessage(failure));
      setStatus('idle');
    } finally {
      pending.current = false;
    }
  }

  if (!auth.session) return <ProfileSecondaryScreen title={t('Reset password')}>
    <Text style={styles.note}>{t('Sign in to reset your password. Demo profiles do not have a password.')}</Text>
  </ProfileSecondaryScreen>;

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ProfileSecondaryScreen title={t('Reset password')}>
      {status === 'success' ? <>
        <Text accessibilityLiveRegion="polite" style={styles.note}>{t('Your password has been updated. Use your new password next time you sign in.')}</Text>
        <PrimaryButton label={t('Back to Profile')} onPress={() => backToProfile(router)} />
      </> : <>
        <Text style={styles.note}>{t('Enter your current password and choose a new password with at least 6 characters.')}</Text>
        <FormInput label={t('Current password')} value={values.currentPassword} onChangeText={value => change('currentPassword', value)}
          error={errors.currentPassword && t(errors.currentPassword)} editable={!submitting} secureTextEntry={!visible}
          autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="current-password"
          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => newPassword.current?.focus()} />
        <FormInput inputRef={newPassword} label={t('New password')} value={values.newPassword} onChangeText={value => change('newPassword', value)}
          error={errors.newPassword && t(errors.newPassword)} editable={!submitting} secureTextEntry={!visible}
          autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="new-password"
          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => confirmation.current?.focus()} />
        <FormInput inputRef={confirmation} label={t('Confirm new password')} value={values.confirmPassword} onChangeText={value => change('confirmPassword', value)}
          error={errors.confirmPassword && t(errors.confirmPassword)} editable={!submitting} secureTextEntry={!visible}
          autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="new-password"
          returnKeyType="done" submitBehavior="blurAndSubmit" onSubmitEditing={() => { void submit(); }} />
        <Pressable accessibilityRole="button" disabled={submitting} accessibilityLabel={visible ? t('Hide passwords') : t('Show passwords')}
          accessibilityState={{ expanded: visible }} style={styles.visibility} onPress={() => setVisible(value => !value)}>
          <Text style={styles.link}>{visible ? t('Hide passwords') : t('Show passwords')}</Text>
        </Pressable>
        {error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
        <PrimaryButton label={submitting ? t('Please wait…') : t('Reset password')} disabled={submitting} onPress={() => { void submit(); }} />
      </>}
    </ProfileSecondaryScreen>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  note: { color: theme.colors.textSecondary, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 21 },
  error: { color: theme.colors.error, fontFamily: theme.fonts.body, fontSize: 14 },
  visibility: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 },
  link: { color: theme.colors.purpleLight, fontFamily: theme.fonts.bodyBold, fontSize: 14 },
});
