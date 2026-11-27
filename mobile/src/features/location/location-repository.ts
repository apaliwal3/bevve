import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import type { LocationRepository } from './location-store';

export const locationRepository: LocationRepository = {
  permissions: () => Location.getForegroundPermissionsAsync(),
  requestPermissions: () => Location.requestForegroundPermissionsAsync(),
  servicesEnabled: () => Location.hasServicesEnabledAsync(),
  async watch(onFix, onError) {
    const subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 25,
      timeInterval: 10_000, mayShowUserSettingsDialog: false }, onFix, onError);
    return () => subscription.remove();
  },
  openSettings: () => Linking.openSettings(),
};
