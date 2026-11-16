import { useTranslation } from '@/localization/language-provider';
import { router, Stack } from 'expo-router';

import { AuthScreen } from '@/features/auth/auth-screen';

export default function LoginRoute() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t("Sign In") }} />
      <AuthScreen mode="login" onBack={() => router.dismissTo('/')} onSwitch={() => router.replace('/signup')} />
    </>
  );
}
