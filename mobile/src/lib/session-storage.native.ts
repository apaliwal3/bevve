import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase stores and refreshes the session; form passwords are never persisted.
export const sessionStorage = AsyncStorage;
