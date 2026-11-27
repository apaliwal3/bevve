import { useMemo, useRef, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/app-icon';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { authErrorMessage } from '@/features/auth/auth-store';
import { useTranslation } from '@/localization/language-provider';
import type { UUID } from '@/features/comparisons/comparison-state';
import { useSavedBars } from '@/features/saved-bars/saved-bars-provider';
import { SavedBarsFeedback } from './saved-bars-feedback';
import { ProfileActivityRow, ProfileEmptyState } from './profile-activity-components';
import { selectProfileFeed, profileFeedCopy, type ProfileActivity } from './profile-feed';
import { ProfileList } from './profile-list';
import { useProfileIdentity } from './use-profile-identity';
import { exitProfile, profileInitials } from './profile-identity';
import { profileDestinations } from './profile-navigation';

export function ProfileView({ activity, onOpenVenue, onWelcome, feedback, ready = true, countReady = true,
  refreshing, onRefresh, sampleVenueIds = [] }: {
  activity: ProfileActivity; onOpenVenue: (id: UUID) => void; onWelcome: () => void;
  feedback?: ReactNode; ready?: boolean; countReady?: boolean; refreshing?: boolean; onRefresh?: () => void; sampleVenueIds?: readonly string[];
}) {
  const { t, format } = useTranslation();
  const auth = useAuth();
  const savedBars = useSavedBars();
  const identity = useProfileIdentity();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<ReturnType<typeof authErrorMessage> | null>(null);
  const pending = useRef(false);
  const feed = useMemo(() => selectProfileFeed(activity), [activity]);
  const name = identity.demo ? t('Demo profile') : t('Your profile');
  const initials = profileInitials(identity.username || name);
  async function leave() {
    if (pending.current) return;
    pending.current = true;
    setSigningOut(true);
    setError(null);
    try { await exitProfile(auth.session, auth.signOut, onWelcome); }
    catch (error) { setError(authErrorMessage(error)); }
    finally { pending.current = false; setSigningOut(false); }
  }
  const header = <View style={styles.header}>
    <View style={styles.top}>
      <Text accessibilityRole="header" style={styles.name}>{name}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Settings')} onPress={() => router.push(profileDestinations.settings)} style={styles.settings}>
        <AppIcon name="languages" color={theme.colors.purpleLight} />
      </Pressable>
    </View>
    <View style={styles.identity}>
      <View accessible accessibilityRole="image" accessibilityLabel={t('Profile initials: {initials}', { initials })} style={styles.avatar}>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.initials}>{initials}</Text>
      </View>
      <Text style={styles.username}>{identity.demo ? '@demo' : identity.username ? '@' + identity.username : t('Username unavailable')}</Text>
      {identity.demo && <Text style={styles.demo}>{t('Demo mode')}</Text>}
      {identity.error && <>
        <Text accessibilityRole="alert" style={styles.note}>{t('Your profile could not be loaded.')}</Text>
        <PrimaryButton label={t('Try again')} variant="secondary" onPress={identity.retry} />
      </>}
    </View>
    <View style={styles.stats}>
      <ProfileStat label={t('Places Been')} value={countReady ? format.number(activity.impressions.length) : '—'} onPress={() => router.push(profileDestinations.places)} />
      <ProfileStat label={t('Want to Try')} value={savedBars.status === 'ready' ? format.number(Object.keys(savedBars.bars).length) : '—'}
        hint={savedBars.status === 'loading' ? t('Please wait…') : savedBars.status === 'error' ? t('Unavailable') : undefined} onPress={() => router.push(profileDestinations.wants)} />
    </View>
    <View style={styles.actions}>
      <PrimaryButton label={t('Edit Profile')} variant="secondary" style={styles.action} onPress={() => router.push(profileDestinations.edit)} />
      <PrimaryButton label={signingOut ? t('Please wait…') : identity.demo ? t('Return to Welcome') : t('Log Out')}
        variant="secondary" style={styles.action} disabled={signingOut} onPress={() => { void leave(); }} />
    </View>
    {error && <Text accessibilityRole="alert" style={styles.note}>{t(error)}</Text>}
    {feedback}
    <SavedBarsFeedback />
    <Text accessibilityRole="header" style={styles.section}>{t('Activity')}</Text>
  </View>;
  return <ProfileList data={feed} keyExtractor={item => item.id} header={header} refreshing={refreshing} onRefresh={onRefresh}
    empty={ready ? <ProfileEmptyState title={t('No activity yet')} message={t('Your saved impressions and contributions will appear here.')} /> : null}
    renderItem={({ item }) => <ProfileActivityRow venue={item.venue} {...profileFeedCopy(item, t, format)} sample={sampleVenueIds.includes(item.venue.id)} onPress={() => onOpenVenue(item.venue.id)} />} />;
}

function ProfileStat({ label, value, hint, onPress }: { label: string; value: string; hint?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={[label, value === '—' ? null : value, hint].filter(Boolean).join('. ')} onPress={onPress}
    style={({ pressed }) => [styles.stat, pressed && styles.pressed]}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {hint && <Text style={styles.note}>{hint}</Text>}
  </Pressable>;
}

const styles = StyleSheet.create({
  header: { gap: 20 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { flex: 1, color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 25 },
  settings: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: theme.colors.surface },
  identity: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: { width: 108, height: 108, borderRadius: 54, borderWidth: 2, borderColor: theme.colors.accentBorder, backgroundColor: theme.colors.purpleButton, alignItems: 'center', justifyContent: 'center', padding: 12 },
  initials: { color: theme.colors.onAccent, fontFamily: theme.fonts.brand, fontSize: 34 },
  username: { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyBold, fontSize: 16, textAlign: 'center' },
  demo: { color: theme.colors.purpleText, backgroundColor: theme.colors.purpleTint, borderRadius: theme.radii.pill, paddingVertical: 4, paddingHorizontal: 12, fontFamily: theme.fonts.bodyBold, fontSize: 11 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, minWidth: 0, minHeight: 112, padding: 14, borderRadius: theme.radii.card, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, gap: 6, justifyContent: 'center' },
  statValue: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 26 },
  statLabel: { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyBold, fontSize: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: { flexGrow: 1, flexBasis: 130, paddingHorizontal: 12 },
  section: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 20, paddingTop: 8, paddingBottom: 4 },
  note: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 12 },
  pressed: { opacity: 0.75 },
});
