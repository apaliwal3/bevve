import { router } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { FlowHeader } from '@/components/flow-header';
import { useTranslation } from '@/localization/language-provider';
import { venueFromPlacesHref } from '@/features/venues/bar-details-navigation';
import { ProfileList } from './profile-list';
import { ProfileActivityRow, ProfileEmptyState } from './profile-activity-components';
import { profileImpressionLabels, type ProfileActivity } from './profile-feed';
import { backToProfile } from './profile-navigation';

export function PlacesBeenScreen({ activity, ready = true, feedback, refreshing, onRefresh, sampleVenueIds = [] }: {
  activity: ProfileActivity; ready?: boolean; feedback?: ReactNode; refreshing?: boolean; onRefresh?: () => void; sampleVenueIds?: readonly string[];
}) {
  const { t } = useTranslation();
  return <ProfileList secondary data={activity.impressions} keyExtractor={entry => entry.venue.id} refreshing={refreshing} onRefresh={onRefresh}
    header={<View style={styles.header}><FlowHeader title={t('Places Been')} eyebrow={t('Profile')} backLabel={t('Back to Profile')} onBack={() => backToProfile(router)} />{feedback}</View>}
    empty={ready ? <ProfileEmptyState title={t('No places yet')} message={t('Save an impression after experiencing a venue to add it here.')} /> : null}
    renderItem={({ item }) => <ProfileActivityRow venue={item.venue} summary={t('Your impression: {impression}', { impression: t(profileImpressionLabels[item.impression]) })}
      sample={sampleVenueIds.includes(item.venue.id)} onPress={() => router.push(venueFromPlacesHref(item.venue.id))} />} />;
}
const styles = StyleSheet.create({ header: { gap: 16, paddingBottom: 20 } });
