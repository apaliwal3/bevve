import { router } from 'expo-router';

import { PersonalCompareScreen } from '@/features/comparisons/personal-compare-screen';

export default function CompareRoute() {
  return (
    <PersonalCompareScreen onViewVenue={(venue) => router.push({
      pathname: '/bars/[barId]', params: { barId: venue.id, returnTo: 'compare' },
    })} />
  );
}
