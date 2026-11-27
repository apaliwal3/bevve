import { Pressable, StyleSheet, Text } from 'react-native';
import { AppIcon } from '@/components/app-icon';
import { BevveTheme as theme } from '@/constants/theme';
import { useTranslation } from '@/localization/language-provider';
import { useSavedBars } from './saved-bars-provider';

export function BookmarkButton({ barId, name }: { barId: string; name: string }) {
  const state = useSavedBars(), { t } = useTranslation();
  const saved = Boolean(state.bars[barId]), op = state.operations[barId];
  const disabled = state.status === 'loading' || state.status === 'error' && state.refreshing || Boolean(op?.saving);
  const retry = Boolean(op?.error) || state.status === 'error';
  const label = state.status === 'error' ? t('Retry saved bars') : retry ? t('Retry saving {name}', { name }) : saved ? t('Remove {name} from Want to visit', { name }) : t('Save {name} to Want to visit', { name });
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint={retry ? t('Your saved bar could not be updated. Tap to retry.') : undefined}
    accessibilityState={{ selected: saved, disabled, busy: Boolean(op?.saving) }} disabled={disabled}
    onPress={event => {
      event.stopPropagation();
      if (state.status === 'error') { void state.refresh(); return; }
      void state.setSaved(barId, op?.error ? op.target : !saved).catch(() => {});
    }} style={({ pressed }) => [styles.button, saved && styles.saved, retry && styles.error, disabled && styles.disabled, pressed && styles.pressed]}>
    <AppIcon name={saved ? 'bookmarkFilled' : 'bookmark'} size={19} color={saved ? theme.colors.purpleLight : theme.colors.text} />
    {retry && <Text style={styles.retry}>{t('Retry')}</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minWidth: 44, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.imageBadge },
  saved: { borderColor: theme.colors.purpleBorder }, error: { borderColor: theme.colors.errorBorder },
  retry: { color: theme.colors.error, fontFamily: theme.fonts.bodyBold, fontSize: 11 },
  disabled: { opacity: 0.5 }, pressed: { opacity: 0.8 },
});
