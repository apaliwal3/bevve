import { router } from 'expo-router';
import { useSavedBars } from '@/features/saved-bars/saved-bars-provider';
import { useMemo } from 'react';
import type { AccountCatalogValue } from '@/features/catalog/catalog-provider';
import { catalogVenue, savedImpressions } from '@/features/catalog/catalog-adapters';
import { CatalogFeedback } from '@/features/catalog/catalog-feedback';
import { useAccountContributions } from '@/features/contributions/account-contributions-provider';
import { AccountContributionFeedback } from '@/features/contributions/account-contribution-panel';
import { venueFromProfileHref } from '@/features/venues/bar-details-navigation';
import { selectProfileContributions } from './profile-activity';
import { ProfileView } from './profile-view';
import { PlacesBeenScreen } from './places-been-screen';

export function AccountProfileScreen({ catalog, places = false }: { catalog: AccountCatalogValue; places?: boolean }) {
  const contributions = useAccountContributions();
  const savedBars = useSavedBars();
  const activity = useMemo(() => selectProfileContributions({ impressions: savedImpressions(catalog.impressions, catalog.venues),
    crowdReports: contributions.crowds, bathroomReviews: contributions.bathrooms, priceObservations: contributions.prices },
  catalog.userId, catalog.venues.map(catalogVenue), catalog.drinks), [catalog.impressions, catalog.venues, catalog.userId, catalog.drinks, contributions.crowds, contributions.bathrooms, contributions.prices]);
  const refreshing = catalog.refreshing || (!places && (contributions.refreshing || savedBars.refreshing));
  function refresh() {
    if (refreshing) return;
    void Promise.allSettled(places ? [catalog.refresh()] : [catalog.refresh(), contributions.refresh(), savedBars.refresh()]);
  }
  const props = { activity, ready: catalog.status === 'ready' && (places || contributions.status === 'ready'),
    feedback: <><CatalogFeedback catalog={catalog} />{!places && <AccountContributionFeedback />}</>,
    refreshing, onRefresh: refresh, sampleVenueIds: catalog.venues.filter(row => row.is_demo).map(row => row.id) };
  if (places) return <PlacesBeenScreen {...props} />;
  return <ProfileView {...props} countReady={catalog.status === 'ready'} onOpenVenue={id => router.push(venueFromProfileHref(id))} />;
}
