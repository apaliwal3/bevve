import { useTranslation } from '@/localization/language-provider';
import { router, Stack } from 'expo-router';

import { AuthScreen } from '@/features/auth/auth-screen';

export default function SignupRoute() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t("Create Account") }} />
      <AuthScreen mode="signup" onBack={() => router.dismissTo('/')} onSwitch={() => router.replace('/login')} />
    </>
  );
}
