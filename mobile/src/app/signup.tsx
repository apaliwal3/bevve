import { router, Stack } from 'expo-router';

import { AuthScreen } from '@/features/auth/auth-screen';

export default function SignupRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Create Account' }} />
      <AuthScreen mode="signup" onBack={() => router.dismissTo('/')} onSwitch={() => router.replace('/login')} />
    </>
  );
}
