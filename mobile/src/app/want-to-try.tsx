import { useVenueCatalog } from '@/features/catalog/catalog-provider';
import { catalogVenue } from '@/features/catalog/catalog-adapters';
import { CatalogFeedback } from '@/features/catalog/catalog-feedback';
import { WantToTryScreen } from '@/features/profile/want-to-try-screen';
import { mockVenues } from '@/fixtures/venues';

export default function WantToTryRoute() {
  const catalog = useVenueCatalog();
  if (catalog.mode === 'demo') return <WantToTryScreen venues={mockVenues} />;
  return <WantToTryScreen venues={catalog.venues.map(catalogVenue)} sampleVenueIds={catalog.venues.filter(row => row.is_demo).map(row => row.id)}
    feedback={<CatalogFeedback catalog={catalog} />} refreshing={catalog.refreshing} onRefresh={() => { void catalog.refresh(); }} />;
}
