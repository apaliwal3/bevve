import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

// Compatibility only: never register this route in the tab navigator. Reuse an
// existing tab stack, or replace this route when opened as a direct link.
export default function LegacyCompareRoute() {
  useFocusEffect(useCallback(() => {
    router.dismissTo('/rankings');
  }, []));
  return null;
}
