import type { PropsWithChildren } from 'react';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { FlowHeader } from '@/components/flow-header';
import { ScreenContainer } from '@/components/screen-container';
import { useTranslation } from '@/localization/language-provider';
import { backToProfile, backToSettings } from './profile-navigation';

export function ProfileSecondaryScreen({ title, children, backDestination = 'profile' }: PropsWithChildren<{ title: string; backDestination?: 'profile' | 'settings' }>) {
  const { t } = useTranslation();
  return <ScreenContainer contentContainerStyle={styles.content}>
    <FlowHeader title={title} eyebrow={t('Profile')} backLabel={backDestination === 'settings' ? t('Back to Settings') : t('Back to Profile')}
      onBack={() => backDestination === 'settings' ? backToSettings(router) : backToProfile(router)} />
    {children}
  </ScreenContainer>;
}
const styles = StyleSheet.create({ content: { padding: 20, gap: 24 } });
