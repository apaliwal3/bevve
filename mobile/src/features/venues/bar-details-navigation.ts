import type { UUID } from '../comparisons/comparison-state.ts';
import { priceComparisonHref } from '../prices/price-navigation.ts';

type BarDetailsBackPlan = {
  label: 'Back to Profile' | 'Back to Rankings' | 'Back to drink prices' | 'Back to Explore';
  mode: 'back' | 'dismiss';
  href: ReturnType<typeof priceComparisonHref> | { pathname: '/rankings' | '/explore' | '/profile' };
};

export function venueFromRankingsHref(barId: UUID) {
  return { pathname: '/bars/[barId]' as const, params: { barId, returnTo: 'rankings' } };
}

export function venueFromProfileHref(barId: UUID) {
  return { pathname: '/bars/[barId]' as const, params: { barId, returnTo: 'profile' } };
}

export function resolveBarDetailsBack(returnTo: string | string[] | undefined, drinkId: string | null, sourceBarId?: string): BarDetailsBackPlan {
  if (returnTo === 'profile') return { label: 'Back to Profile', mode: 'back', href: { pathname: '/profile' } };
  if (returnTo === 'rankings') return { label: 'Back to Rankings', mode: 'back', href: { pathname: '/rankings' } };
  // Old links may still carry this context. Dismiss to the surviving Rankings
  // tab rather than popping to an obsolete screen in the previous stack.
  if (returnTo === 'compare') return { label: 'Back to Rankings', mode: 'dismiss', href: { pathname: '/rankings' } };
  if (returnTo === 'prices') return { label: 'Back to drink prices', mode: 'back', href: priceComparisonHref(drinkId, sourceBarId) };
  return { label: 'Back to Explore', mode: 'dismiss', href: { pathname: '/explore' } };
}

type BackNavigator = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: BarDetailsBackPlan['href']) => void;
  dismissTo: (href: BarDetailsBackPlan['href']) => void;
};

export function navigateBackFromBarDetails(plan: BarDetailsBackPlan, navigation: BackNavigator) {
  if (plan.mode === 'dismiss') navigation.dismissTo(plan.href);
  else if (navigation.canGoBack()) navigation.back();
  else navigation.replace(plan.href);
}
