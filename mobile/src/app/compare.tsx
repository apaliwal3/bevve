import { router, Stack } from 'expo-router';

import { PersonalCompareScreen } from '@/features/comparisons/personal-compare-screen';

export default function CompareRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Personal bar comparisons' }} />
      <PersonalCompareScreen onViewVenue={(venue) => router.push({
        pathname: '/bars/[barId]', params: { barId: venue.id, returnTo: 'compare' },
      })} />
    </>
  );
}
