import type { PropsWithChildren } from 'react';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { FlowHeader } from '@/components/flow-header';
import { ScreenContainer } from '@/components/screen-container';
import { useTranslation } from '@/localization/language-provider';
import { backToProfile } from './profile-navigation';

export function ProfileSecondaryScreen({ title, children }: PropsWithChildren<{ title: string }>) {
  const { t } = useTranslation();
  return <ScreenContainer contentContainerStyle={styles.content}>
    <FlowHeader title={title} eyebrow={t('Profile')} backLabel={t('Back to Profile')} onBack={() => backToProfile(router)} />
    {children}
  </ScreenContainer>;
}
const styles = StyleSheet.create({ content: { padding: 20, gap: 24 } });
