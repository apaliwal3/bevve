import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/app-icon';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { AccountComparisonPanel } from '@/features/comparisons/account-comparison-panel';
import { useAccountComparisons } from '@/features/comparisons/account-comparisons-provider';
import { AccountIncidentPanel } from '@/features/contributions/account-safety-panel';
import { ContributionBatch, SaveContributionsButton } from '@/features/contributions/contribution-batch';
import { ImpressionSelector, impressionLabels } from '@/features/impressions/impression-selector';
import type { Impression } from '@/features/impressions/impression-state';
import { ratingOverlayStyles as styles } from '@/features/ratings/rating-overlay-styles';
import { useTranslation } from '@/localization/language-provider';
import type { AccountCatalogValue } from './catalog-provider';

export function AccountImpressionEditor({ catalog, barId, name, onClose, children }: {
  catalog: AccountCatalogValue; barId: string; name: string; onClose: () => void; children?: ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const comparisons = useAccountComparisons();
  const [draft, setDraft] = useState<Impression | null>(catalog.impressions[barId]?.impression ?? null);
  const [step, setStep] = useState<'impression' | 'comparisons' | 'contributions' | 'private-report'>('impression');
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noOpponents, setNoOpponents] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const busy = useRef(false);
  const contributionBusy = useRef(false);
  const onContributionSaving = useCallback((value: boolean) => { contributionBusy.current = value; }, []);
  const active = useRef(true);
  const comparisonStarted = useRef(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const unchanged = draft !== null && draft === catalog.impressions[barId]?.impression;
  const batch = comparisons.batches[barId];
  const pending = Boolean(batch && batch.round < batch.opponents.length);
  const canCompare = catalog.venues.some(row => row.id !== barId && catalog.impressions[row.id]);
  const top = Math.max(72, insets.top + theme.spacing.lg);
  const bottom = Math.max(theme.spacing.xxl, insets.bottom + theme.spacing.lg);
  useEffect(() => { active.current = true; return () => { active.current = false; progress.stopAnimation(); }; }, [progress]);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step, batch?.round]);
  useEffect(() => {
    if (step !== 'comparisons' || comparisons.status !== 'ready') return;
    const timer = setTimeout(() => {
      if (!active.current) return;
      if (!canCompare && !pending) { setNoOpponents(true); setStep('contributions'); return; }
      if (!comparisonStarted.current) {
        comparisonStarted.current = true;
        if (!pending) comparisons.begin(barId, batch?.id ?? null);
      } else if (batch && !pending) setStep('contributions');
    }, 0);
    return () => clearTimeout(timer);
  }, [step, comparisons, canCompare, pending, barId, batch]);

  function close() {
    if (busy.current || contributionBusy.current || batch?.saving) return;
    active.current = false;
    onClose();
  }
  async function animateIn() {
    let reduced = false;
    try { reduced = await AccessibilityInfo.isReduceMotionEnabled(); } catch {}
    if (!active.current) return;
    Animated.timing(progress, { toValue: 1, duration: reduced ? 0 : 250, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }
  function compare() { comparisonStarted.current = false; setStep('comparisons'); }
  async function next(resume = true) {
    if (busy.current || !draft) return;
    busy.current = true;
    setSaving(true);
    setError(false);
    try {
      if (!unchanged) await catalog.save(barId, draft);
      if (active.current) { if (resume) compare(); else setStep('contributions'); }
    } catch { if (active.current) setError(true); }
    finally { busy.current = false; if (active.current) setSaving(false); }
  }

  return <Modal visible transparent animationType="none" presentationStyle="overFullScreen" statusBarTranslucent navigationBarTranslucent onShow={() => { void animateIn(); }} onRequestClose={close}>
    <View style={[styles.root, { paddingTop: top, paddingBottom: bottom, paddingLeft: Math.max(theme.spacing.lg, insets.left + theme.spacing.sm), paddingRight: Math.max(theme.spacing.lg, insets.right + theme.spacing.sm) }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]} />
      <Pressable accessible={false} style={StyleSheet.absoluteFill} disabled={saving} onPress={close} />
      <Animated.View accessibilityViewIsModal onAccessibilityEscape={close} style={[styles.panel, { maxHeight: Math.max(0, height - top - bottom), opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-Math.min(32, top - insets.top), 0] }) }] }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>{t('BAR ACTIONS')}</Text><Text accessibilityRole="header" style={styles.venueName}>{name}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Close bar actions')} disabled={saving} onPress={close} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <AppIcon name="close" size={18} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
          keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag">
          {step === 'impression' ? <View style={styles.ratingCard}>
            <Text accessibilityRole="header" style={styles.question}>{t('How was it?')}</Text>
            <ImpressionSelector value={draft} disabled={saving} onChange={value => { if (!busy.current) setDraft(value); }} />
            {error && <Text accessibilityRole="alert" style={styles.description}>{t('Your impression could not be saved. Check your connection and try again.')}</Text>}
            {unchanged ? <>
              {(pending || canCompare) && <PrimaryButton label={pending ? t('Resume comparisons') : t('Compare this bar again')} disabled={saving} onPress={compare} />}
              <PrimaryButton label={t('Continue to contributions')} variant="secondary" disabled={saving} onPress={() => setStep('contributions')} />
            </> : <>
              <PrimaryButton label={saving ? t('Saving impression…') : t('Save impression and continue')} disabled={saving || !draft} onPress={() => { void next(); }} />
              {pending && <PrimaryButton label={t('Save and continue to optional contributions')} variant="secondary" disabled={saving || !draft} onPress={() => { void next(false); }} />}
            </>}
            <PrimaryButton label={t('Optional private incident report')} variant="secondary" disabled={saving} onPress={() => setStep('private-report')} />
          </View> : step === 'comparisons' ? <AccountComparisonPanel catalog={catalog} barId={barId} journey /> : <ContributionBatch onSavingChange={onContributionSaving}>
            {step === 'private-report' ? <AccountIncidentPanel catalog={catalog} barId={barId} /> : <>
            <View style={styles.ratingCard}>
              <Text style={styles.eyebrow}>{t('YOUR EXPERIENCE')}</Text>
              {draft && <Text style={styles.question}>{t(impressionLabels[draft])}</Text>}
              <Text style={styles.description}>{t('Saved to your account')}</Text>
              {noOpponents && <Text style={styles.description}>{t('No other experienced bars are available to compare yet.')}</Text>}
            </View>
            <Text style={styles.description}>{t('All five contributions are optional. Fill in any cards, then save when you are done.')}</Text>
            {children}
            </>}
            <SaveContributionsButton onComplete={close} />
          </ContributionBatch>}
        </ScrollView>
      </Animated.View>
    </View>
  </Modal>;
}
