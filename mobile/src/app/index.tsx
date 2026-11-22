import { useTranslation } from '@/localization/language-provider';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { BevveTheme as theme } from '@/constants/theme';
import { welcomeMock as welcome } from '@/fixtures/welcome';
import { useAuth } from '@/features/auth/auth-provider';

export default function WelcomeScreen() {
  const { session } = useAuth();
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const notice = t('Sign in to your account, or explore sample venues without an account.');

  return (
    <ScreenContainer edges={['left', 'right']} style={styles.screen}>
      <View style={[styles.hero, { minHeight: Math.max(height * 0.68, 460 + insets.top) }]}>
        <Image
          source={welcome.image}
          accessibilityLabel={t('Friends socializing on a city street at night')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade]} />
        <View style={[styles.brand, { paddingTop: Math.max(72, insets.top + theme.spacing.lg) }]}>
          <Logo size={31} />
          <Text style={styles.city}>{t('MILANO AFTER DARK')}</Text>
        </View>
        <View style={styles.copy}>
          <View style={styles.kickerPill}>
            <Text style={styles.kicker}>{t('Continue as a local')}</Text>
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {t('Find your next spot')}
          </Text>
          <Text style={styles.description}>{t('Real-time crowd, prices and honest local details for better nights out.')}</Text>
        </View>
      </View>
      <View style={[styles.actions, { paddingBottom: Math.max(theme.spacing.xxl, insets.bottom) }]}>
        <Link href="/login" asChild>
          <PrimaryButton label={t("Sign In")} />
        </Link>
        <Link href="/signup" asChild>
          <PrimaryButton label={t("Create Account")} variant="secondary" />
        </Link>
        <Link href="/explore" asChild>
          <Pressable style={styles.demoLink} accessibilityHint={t("Browse sample venues without signing in")}>
            <Text style={styles.demoLinkLabel}>{session ? t('Explore venues →') : t("Explore demo →")}</Text>
          </Pressable>
        </Link>
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.colors.welcomeBackground },
  hero: {
    overflow: 'hidden',
    borderBottomLeftRadius: theme.radii.hero,
    borderBottomRightRadius: theme.radii.hero,
    backgroundColor: theme.colors.surface,
  },
  shade: {
    // React Native 0.88 renders this style natively; the string form also works on web.
    backgroundImage: `linear-gradient(180deg, ${theme.colors.photoShade} 0%, ${theme.colors.photoShadeMiddle} 34%, ${theme.colors.welcomeBackground} 100%), linear-gradient(120deg, ${theme.colors.photoPurple}, ${theme.colors.transparent} 56%)`,
  },
  brand: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  city: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1.5,
  },
  copy: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.huge,
    paddingBottom: 28,
  },
  kickerPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.purpleTint,
    borderColor: theme.colors.purpleBorder,
    borderWidth: 1,
    borderRadius: theme.radii.sm,
  },
  kicker: {
    color: theme.colors.purpleText,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    maxWidth: 320,
    color: theme.colors.text,
    fontFamily: theme.fonts.brand,
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.8,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  description: {
    maxWidth: 315,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 19,
  },
  actions: {
    gap: 10,
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
  },
  notice: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  demoLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  demoLinkLabel: { color: theme.colors.purpleLight, fontFamily: theme.fonts.bodyBold, fontSize: 12 },
});
