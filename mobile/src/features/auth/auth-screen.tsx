import { useTranslation } from '@/localization/language-provider';
import { useCallback, useReducer, useRef, useState, type ComponentRef } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { FormInput } from '@/components/form-input';
import { Logo } from '@/components/logo';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { BevveTheme as theme } from '@/constants/theme';

import { authFormReducer, createAuthFormState } from './auth-form-state';
import { validateAuthForm, type AuthMode } from './auth-validation';
import { useAuth } from './auth-provider';
import { authErrorMessage } from './auth-store';

type AuthScreenProps = { mode: AuthMode; onBack: () => void; onSwitch: () => void };

export function AuthScreen({ mode, onBack, onSwitch }: AuthScreenProps) {
  const { t } = useTranslation();
  const auth = useAuth();
  const [state, dispatch] = useReducer(authFormReducer, mode, createAuthFormState);
  const [requestError, setRequestError] = useState<ReturnType<typeof authErrorMessage> | null>(null);
  const attempt = useRef(0);
  const pending = useRef(false);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const insets = useSafeAreaInsets();
  const isSignup = mode === 'signup';
  const submitting = state.status === 'submitting';
  const visibleError = requestError ?? auth.error;

  useFocusEffect(useCallback(() => {
    if (auth.session) router.replace('/profile');
  }, [auth.session]));

  useFocusEffect(useCallback(() => () => {
    // Clear transient input even when a blurred route remains mounted in the stack.
    dispatch({ type: 'reset' });
    attempt.current++;
    pending.current = false;
    setRequestError(null);
    Keyboard.dismiss();
  }, []));

  function leave(destination: () => void) {
    dispatch({ type: 'reset' });
    Keyboard.dismiss();
    destination();
  }

  async function submit() {
    if (pending.current || state.status !== 'idle') return;
    const values = state.values;
    dispatch({ type: 'submit' });
    Keyboard.dismiss();
    if (Object.keys(validateAuthForm(mode, values)).length) return;
    pending.current = true;
    const request = ++attempt.current;
    setRequestError(null);
    try {
      let outcome: 'signed-in' | 'confirm-email' = 'signed-in';
      if (isSignup) outcome = await auth.signUp(values.email, values.password, values.username);
      else await auth.signIn(values.email, values.password);
      if (request !== attempt.current) return;
      if (outcome === 'confirm-email') dispatch({ type: 'confirm-email' });
      else router.replace('/profile');
    } catch (error) {
      if (request !== attempt.current) return;
      dispatch({ type: 'failed' });
      setRequestError(authErrorMessage(error));
    } finally {
      if (request === attempt.current) pending.current = false;
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenContainer
        style={styles.background}
        contentContainerStyle={[styles.content, {
          paddingTop: Math.max(16, 72 - insets.top),
          paddingBottom: Math.max(18, 28 - insets.bottom),
        }]}>
        <View style={styles.header}>
          <Pressable disabled={submitting} accessibilityRole="button" accessibilityLabel={t("Back to Welcome")} onPress={() => leave(onBack)} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <AppIcon name="back" size={20} color={theme.colors.text} />
          </Pressable>
          <View style={styles.logo}><Logo /></View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>{isSignup ? t("CREATE ACCOUNT") : t("SIGN IN")}</Text>
          <Text accessibilityRole="header" style={styles.title}>{isSignup ? t("Join bevve") : t("Welcome back")}</Text>
          <Text style={styles.description}>{isSignup
            ? t("Create your profile and start shaping your nightlife ranking.")
            : t("Sign in to keep discovering Milan your way.")}</Text>
        </View>

        <View style={styles.form}>
          {isSignup && (
            <FormInput
              label={t("Username")}
              editable={!submitting}
              value={state.values.username}
              onChangeText={(value) => dispatch({ type: 'change', field: 'username', value })}
              error={state.errors.username ? t(state.errors.username) : undefined}
              placeholder={t("Your name")}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              importantForAutofill="no"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          )}
          <FormInput
            inputRef={emailRef}
            label={t("Email")}
            editable={!submitting}
            value={state.values.email}
            onChangeText={(value) => dispatch({ type: 'change', field: 'email', value })}
            error={state.errors.email ? t(state.errors.email) : undefined}
            placeholder={t("you@example.com")}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            importantForAutofill="no"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <FormInput
            inputRef={passwordRef}
            label={t("Password")}
            editable={!submitting}
            value={state.values.password}
            onChangeText={(value) => dispatch({ type: 'change', field: 'password', value })}
            error={state.errors.password ? t(state.errors.password) : undefined}
            placeholder={t("At least 6 characters")}
            secureTextEntry={!state.passwordVisible}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            importantForAutofill="no"
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={submit}
            trailing={(
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={state.passwordVisible ? t("Hide password") : t("Show password")}
                accessibilityState={{ expanded: state.passwordVisible }}
                onPress={() => dispatch({ type: 'toggle-password' })}
                style={({ pressed }) => [styles.visibility, pressed && styles.pressed]}>
                <Text style={styles.visibilityLabel}>{state.passwordVisible ? t("Hide") : t("Show")}</Text>
              </Pressable>
            )}
          />
          {visibleError && <Text accessibilityRole="alert" style={styles.description}>{t(visibleError)}</Text>}
          {state.status === 'confirm-email' && <Text accessibilityLiveRegion="polite" style={styles.description}>{t('Check your email to confirm your account, then return here to sign in.')}</Text>}
          <PrimaryButton label={submitting ? t('Please wait…') : isSignup ? t("Create Account") : t("Sign In")} onPress={() => { void submit(); }} disabled={submitting || state.status === 'confirm-email'} style={styles.submit} />
        </View>

        <Pressable
          accessibilityRole="link"
          disabled={submitting}
          accessibilityLabel={isSignup ? t("Already have an account? Sign In") : t("Don't have an account? Create Account")}
          onPress={() => leave(onSwitch)}
          style={({ pressed }) => [styles.switch, pressed && styles.pressed]}>
          <Text style={styles.switchText}>{(isSignup ? t('Already have an account?') : t("Don't have an account?")) + ' '}
            <Text style={styles.switchAccent}>{isSignup ? t("Sign In") : t("Create Account")}</Text>
          </Text>
        </Pressable>
        <Text style={styles.demoNote}>{t('Sign in to your account. Venue activity is currently a demo.')}</Text>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  background: {
    backgroundImage: 'linear-gradient(145deg, ' + theme.colors.purpleTint + ', ' + theme.colors.background + ' 48%)'
  },
  content: {
    paddingHorizontal: theme.spacing.xl
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center'
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
  logo: {
    flex: 1,
    alignItems: 'center'
  },
  headerSpacer: {
    width: 44
  },
  intro: {
    paddingTop: 56,
    paddingBottom: 28,
    gap: theme.spacing.sm
  },
  eyebrow: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.brand,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1
  },
  description: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 19,
    maxWidth: 310
  },
  form: {
    gap: 15
  },
  visibility: {
    minWidth: 58,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm
  },
  visibilityLabel: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12
  },
  submit: {
    marginTop: theme.spacing.sm
  },
  switch: {
    minHeight: 44,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    justifyContent: 'center'
  },
  switchText: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 19
  },
  switchAccent: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold
  },
  demoNote: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: theme.spacing.sm
  },
  pressed: {
    opacity: 0.75
  }
});
