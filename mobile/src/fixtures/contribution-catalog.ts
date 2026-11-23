import { languageCatalog } from '../../../shared/language-contracts.ts';
export { languageCatalog, type VenueLanguageCode } from '../../../shared/language-contracts.ts';

// Fictional catalog UUIDs match the existing venue snapshots. These are not backend rows.
// Serving information belongs to the catalog, never to a price observation.
export type CatalogDrink = {
  id: string;
  name: string;
  category: string;
  serving_ml: number;
};

export const mockDrinkCatalog: readonly CatalogDrink[] = [
  { id: 'b3eaae75-0317-4411-9814-7e7a79f4b101', name: 'Beer', category: 'Beer', serving_ml: 400 },
  { id: 'b3eaae75-0317-4411-9814-7e7a79f4b102', name: 'Aperol Spritz', category: 'Cocktail', serving_ml: 250 },
  { id: 'b3eaae75-0317-4411-9814-7e7a79f4b103', name: 'Gin & Tonic', category: 'Long drink', serving_ml: 300 },
];

export function languageName(code: string): string {
  return languageCatalog.find((language) => language.code === code)?.name ?? code;
}
