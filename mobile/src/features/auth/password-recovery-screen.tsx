import { useCallback, useRef, useState, type PropsWithChildren } from 'react';
import { router, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { FlowHeader } from '@/components/flow-header';
import { FormInput } from '@/components/form-input';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { BevveTheme as theme } from '@/constants/theme';
import { useTranslation } from '@/localization/language-provider';
import { validateRecoveredPassword, type RecoveredPasswordErrors } from '../../../../shared/password-recovery';
import { useAuth } from './auth-provider';
import { authErrorMessage } from './auth-store';
import { validateEmail } from './auth-validation';

function RecoveryLayout({ children, onBack }: PropsWithChildren<{ onBack: () => void }>) {
  const { t } = useTranslation();
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScreenContainer contentContainerStyle={styles.content}>
      <FlowHeader eyebrow={t('SIGN IN')} title={t('Reset password')} backLabel={t('Go back')} onBack={onBack} />
      {children}
    </ScreenContainer>
  </KeyboardAvoidingView>;
}

export function ForgotPasswordScreen() {
  const auth = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<ReturnType<typeof validateEmail>>();
  const [error, setError] = useState<ReturnType<typeof authErrorMessage> | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent'>('idle');
  const pending = useRef(false), attempt = useRef(0);
  useFocusEffect(useCallback(() => () => {
    attempt.current++;
    setEmail(''); setEmailError(undefined); setError(null); setStatus('idle');
    Keyboard.dismiss();
  }, []));

  async function send() {
    if (pending.current) return;
    const invalid = validateEmail(email);
    setEmailError(invalid); setError(null);
    if (invalid) return;
    pending.current = true;
    const request = ++attempt.current;
    setStatus('submitting'); Keyboard.dismiss();
    try {
      await auth.requestPasswordRecovery(email, Linking.createURL('recover-password'));
      if (request !== attempt.current) return;
      setEmail(''); setStatus('sent');
    } catch (failure) {
      if (request !== attempt.current) return;
      setError(authErrorMessage(failure)); setStatus('idle');
    } finally { pending.current = false; }
  }

  return <RecoveryLayout onBack={() => router.replace('/login')}>
    {status === 'sent' ? <>
      <Text accessibilityLiveRegion="polite" style={styles.note}>{t('If an account exists for that email, you will receive a password reset link. Open it to choose a new password.')}</Text>
      <PrimaryButton label={t('Send another link')} variant="secondary" onPress={() => setStatus('idle')} />
      <PrimaryButton label={t('Sign In')} onPress={() => router.replace('/login')} />
    </> : <>
      <Text style={styles.note}>{t('Enter your account email and we will send you a link to reset your password.')}</Text>
      <FormInput label={t('Email')} value={email} onChangeText={value => { if (!pending.current) { setEmail(value); setEmailError(undefined); setError(null); } }}
        error={emailError && t(emailError)} editable={status !== 'submitting'} keyboardType="email-address" autoCapitalize="none"
        autoCorrect={false} spellCheck={false} autoComplete="email" returnKeyType="done" submitBehavior="blurAndSubmit" onSubmitEditing={() => { void send(); }} />
      {error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
      <PrimaryButton label={status === 'submitting' ? t('Please wait…') : t('Send reset link')} disabled={status === 'submitting'} onPress={() => { void send(); }} />
    </>}
  </RecoveryLayout>;
}

export function RecoverPasswordScreen() {
  const auth = useAuth();
  // The route tree remounts when a link signs in an account. Recovery authority
  // stays in the auth store, while drafts are always scoped to the current user.
  return <RecoveredPasswordForm key={auth.session?.user.id ?? 'guest'} />;
}

function RecoveredPasswordForm() {
  const auth = useAuth();
  const { t } = useTranslation();
  const [values, setValues] = useState({ newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState<RecoveredPasswordErrors>({});
  const [error, setError] = useState<ReturnType<typeof authErrorMessage> | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [visible, setVisible] = useState(false);
  const pending = useRef(false), attempt = useRef(0);
  useFocusEffect(useCallback(() => () => {
    attempt.current++;
    setValues({ newPassword: '', confirmPassword: '' }); setErrors({}); setError(null); setStatus('idle'); setVisible(false);
    Keyboard.dismiss();
  }, []));

  async function save() {
    if (pending.current || auth.recovery !== 'ready' || status !== 'idle') return;
    const invalid = validateRecoveredPassword(values);
    setErrors(invalid); setError(null);
    if (Object.keys(invalid).length) return;
    pending.current = true;
    const request = ++attempt.current;
    setStatus('submitting'); setVisible(false); Keyboard.dismiss();
    try {
      await auth.completePasswordRecovery(values);
      if (request !== attempt.current) return;
      setValues({ newPassword: '', confirmPassword: '' }); setStatus('success');
    } catch (failure) {
      if (request !== attempt.current) return;
      setError(authErrorMessage(failure)); setStatus('idle');
    } finally { pending.current = false; }
  }

  function requestNewLink() { auth.finishPasswordRecovery(); router.replace('/forgot-password'); }
  return <RecoveryLayout onBack={requestNewLink}>
    {auth.recovery === 'verifying' ? <Text accessibilityLiveRegion="polite" style={styles.note}>{t('Checking your reset link…')}</Text>
      : auth.recovery !== 'ready' ? <>
        <Text accessibilityRole="alert" style={styles.error}>{t('This reset link is invalid or has expired. Request a new link.')}</Text>
        <PrimaryButton label={t('Request a new link')} onPress={requestNewLink} />
      </> : status === 'success' ? <>
        <Text accessibilityLiveRegion="polite" style={styles.note}>{t('Your password has been updated. Use your new password next time you sign in.')}</Text>
        <PrimaryButton label={t('Continue to Explore')} onPress={() => { auth.finishPasswordRecovery(); router.replace('/explore'); }} />
      </> : <>
        <Text style={styles.note}>{t('Choose a new password with at least 6 characters. You do not need your old password.')}</Text>
        {(['newPassword', 'confirmPassword'] as const).map(field => <FormInput key={field}
          label={field === 'newPassword' ? t('New password') : t('Confirm new password')} value={values[field]}
          onChangeText={value => { if (!pending.current) { setValues(previous => ({ ...previous, [field]: value })); setErrors(previous => ({ ...previous, [field]: undefined })); setError(null); } }}
          error={errors[field] && t(errors[field])} editable={status !== 'submitting'} secureTextEntry={!visible}
          autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="new-password"
          returnKeyType="done" submitBehavior="blurAndSubmit" onSubmitEditing={() => { void save(); }} />)}
        <Pressable accessibilityRole="button" accessibilityLabel={visible ? t('Hide passwords') : t('Show passwords')}
          accessibilityState={{ expanded: visible }} disabled={status === 'submitting'} style={styles.visibility} onPress={() => setVisible(value => !value)}>
          <Text style={styles.link}>{visible ? t('Hide passwords') : t('Show passwords')}</Text>
        </Pressable>
        {error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
        <PrimaryButton label={status === 'submitting' ? t('Please wait…') : t('Reset password')} disabled={status === 'submitting'} onPress={() => { void save(); }} />
      </>}
  </RecoveryLayout>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, gap: 24 },
  note: { color: theme.colors.textSecondary, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 21 },
  error: { color: theme.colors.error, fontFamily: theme.fonts.body, fontSize: 14 },
  visibility: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 },
  link: { color: theme.colors.purpleLight, fontFamily: theme.fonts.bodyBold, fontSize: 14 },
});
