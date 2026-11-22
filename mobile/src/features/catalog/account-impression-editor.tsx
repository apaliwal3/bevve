import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { ImpressionSelector } from '@/features/impressions/impression-selector';
import type { Impression } from '@/features/impressions/impression-state';
import { useTranslation } from '@/localization/language-provider';
import type { AccountCatalogValue } from './catalog-provider';

export function AccountImpressionEditor({ catalog, barId, name, onClose, children }: {
  catalog: AccountCatalogValue; barId: string; name: string; onClose: () => void; children?: ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Impression | null>(catalog.impressions[barId]?.impression ?? null);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const busy = useRef(false);
  const active = useRef(true);
  const saving = Boolean(catalog.saving[barId]);
  const unchanged = draft === catalog.impressions[barId]?.impression;
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  function close() {
    if (busy.current) return;
    active.current = false;
    onClose();
  }
  async function save() {
    if (busy.current || !draft || unchanged) return;
    busy.current = true;
    setError(false);
    try {
      await catalog.save(barId, draft);
      if (active.current) setSaved(true);
    } catch {
      if (active.current) setError(true);
    } finally { busy.current = false; }
  }

  return <Modal transparent animationType="fade" onRequestClose={close}>
    <View style={[styles.backdrop, { paddingTop: Math.max(72, insets.top + 20), paddingBottom: Math.max(24, insets.bottom + 16) }]}>
      <ScrollView accessibilityViewIsModal style={styles.panel} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>{name}</Text>
        <Text style={styles.question}>{t('How was it?')}</Text>
        <ImpressionSelector value={draft} disabled={saving} onChange={value => { if (!busy.current) { setDraft(value); setSaved(false); } }} />
        <Text style={styles.note}>{t('One editable impression per venue, saved to your account.')}</Text>
        {error && <Text accessibilityRole="alert" style={styles.note}>{t('Your impression could not be saved. Check your connection and try again.')}</Text>}
        {saved && <Text accessibilityLiveRegion="polite" style={styles.note}>{t('Saved to your account')}</Text>}
        <PrimaryButton label={saving ? t('Saving impression…') : t('Save impression')} disabled={saving || !draft || unchanged} onPress={() => { void save(); }} />
        {children}
        <PrimaryButton variant="secondary" label={children ? t('Close') : saved ? t('Done') : t('Cancel')} disabled={saving} onPress={close} />
      </ScrollView>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: theme.spacing.lg },
  panel: { flexGrow: 0, borderRadius: theme.radii.panel, backgroundColor: theme.colors.surface },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 24 },
  question: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 20 },
  note: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 20 },
});
