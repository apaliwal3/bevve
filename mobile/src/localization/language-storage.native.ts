import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LanguageStorage } from './language-store';

export const languageStorage: LanguageStorage = {
  persistent: true,
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};
