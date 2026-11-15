import { router, Stack } from 'expo-router';

import { AuthScreen } from '@/features/auth/auth-screen';

export default function LoginRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Sign In' }} />
      <AuthScreen mode="login" onBack={() => router.dismissTo('/')} onSwitch={() => router.replace('/signup')} />
    </>
  );
}
