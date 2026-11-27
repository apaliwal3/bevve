import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { useSavedBars } from '@/features/saved-bars/saved-bars-provider';
import { useTranslation } from '@/localization/language-provider';

export function SavedBarsFeedback() {
  const state = useSavedBars(), { t } = useTranslation();
  if (state.status === 'ready' && !state.error) return null;
  return <View style={styles.box}>
    <Text accessibilityRole={state.error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.note}>
      {state.error ? t('Your saved bars could not be refreshed. Try again.') : t('Loading saved bars…')}
    </Text>
    {state.error && <PrimaryButton label={t('Retry saved bars')} variant="secondary" disabled={state.refreshing} onPress={() => { void state.refresh(); }} />}
  </View>;
}
const styles = StyleSheet.create({
  box: { gap: 12 }, note: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 13 },
});
