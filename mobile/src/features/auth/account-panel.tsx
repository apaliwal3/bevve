import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/localization/language-provider';
import { useAuth } from './auth-provider';
import { authErrorMessage } from './auth-store';

export function AccountPanel() {
  const { session, signOut } = useAuth();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<{ userId: string; retry: number; username: string | null; error: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<ReturnType<typeof authErrorMessage> | null>(null);
  const pending = useRef(false);
  const userId = session?.user.id;
  const currentProfile = profile?.userId === userId && profile?.retry === retry ? profile : null;

  useEffect(() => {
    let active = true;
    if (supabase && userId) {
      void supabase.from('profiles').select('username').eq('id', userId).single().then(({ data, error }) => {
        if (!active) return;
        setProfile({ userId, retry, username: !error && typeof data?.username === 'string' ? data.username : null, error: Boolean(error || !data) });
      }, () => { if (active) setProfile({ userId, retry, username: null, error: true }); });
    }
    return () => { active = false; };
  }, [userId, retry]);

  if (!session) return null;
  async function leave() {
    if (pending.current) return;
    pending.current = true;
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
      router.dismissTo('/');
    } catch (error) {
      pending.current = false;
      setSigningOut(false);
      setError(authErrorMessage(error));
    }
  }

  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>{t('Your account')}</Text>
    <Text style={styles.text}>{currentProfile?.username ?? t('Signed in')}</Text>
    <Text style={styles.text}>{session.user.email}</Text>
    <Text style={styles.text}>{t('Your account is saved online. The activity below is demo data for this session.')}</Text>
    {currentProfile?.error && <>
      <Text accessibilityRole="alert" style={styles.text}>{t('Your profile could not be loaded.')}</Text>
      <PrimaryButton variant="secondary" label={t('Try again')} onPress={() => setRetry(value => value + 1)} />
    </>}
    {error && <Text accessibilityRole="alert" style={styles.text}>{t(error)}</Text>}
    <PrimaryButton variant="secondary" label={signingOut ? t('Please wait…') : t('Sign Out')}
      disabled={signingOut} onPress={() => { void leave(); }} />
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: theme.spacing.lg, gap: theme.spacing.sm, backgroundColor: theme.colors.surface, borderRadius: theme.radii.card },
  title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 18 },
  text: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 18 },
});
