import { useSavedImpressions } from '@/features/comparisons/personal-comparisons-provider';
import { useProfileContributions } from '@/features/ratings/venue-ratings-provider';
import type { UUID } from '@/features/comparisons/comparison-state';
import { ProfileView } from './profile-view';

export function ProfileScreen({ onOpenVenue, onWelcome }: { onOpenVenue: (id: UUID) => void; onWelcome: () => void }) {
  const savedImpressions = useSavedImpressions();
  const activity = useProfileContributions(savedImpressions);
  return <ProfileView activity={activity} onOpenVenue={onOpenVenue} onWelcome={onWelcome} />;
}
