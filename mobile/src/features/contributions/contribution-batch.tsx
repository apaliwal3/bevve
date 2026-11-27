import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { Text } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { useTranslation } from '@/localization/language-provider';
import { inlineFormStyles as styles } from './inline-form-styles';
import { createContributionBatch } from './contribution-batch-store';
import type { ContributionFormFeedback } from './contribution-form-feedback';

type Batch = ReturnType<typeof createContributionBatch>;
export const ContributionBatchContext = createContext<{ store: Batch; saving: boolean } | null>(null);

export function ContributionBatch({ children, onSavingChange }: PropsWithChildren<{ onSavingChange?: (saving: boolean) => void }>) {
  const [store] = useState(createContributionBatch);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    const update = () => onSavingChange?.(store.getSnapshot().saving);
    update();
    const unsubscribe = store.subscribe(update);
    return () => { unsubscribe(); onSavingChange?.(false); };
  }, [store, onSavingChange]);
  return <ContributionBatchContext.Provider value={{ store, saving: snapshot.saving }}>{children}</ContributionBatchContext.Provider>;
}

export function useBatchedContribution(key: string, draft: unknown, valid: boolean, save: () => void | Promise<void>, feedback?: ContributionFormFeedback, dirty?: boolean) {
  const batch = useContext(ContributionBatchContext);
  const fingerprint = JSON.stringify(draft);
  const initial = useRef(fingerprint);
  useEffect(() => {
    batch?.store.register(key, { fingerprint, dirty: (dirty ?? fingerprint !== (batch.store.getConfirmed(key) ?? initial.current)) || Boolean(feedback?.pending),
      valid: Boolean(feedback?.pending) || valid, save: feedback?.pending ? feedback.retry : save });
  });
  const store = batch?.store;
  useEffect(() => () => { store?.remove(key); }, [store, key]);
  return { batched: Boolean(batch), saving: Boolean(batch?.saving) };
}

export function SaveContributionsButton({ onComplete }: { onComplete: () => void }) {
  const batch = useContext(ContributionBatchContext)!;
  const { t } = useTranslation();
  const snapshot = useSyncExternalStore(batch.store.subscribe, batch.store.getSnapshot, batch.store.getSnapshot);
  return <>
    {snapshot.invalid && <Text accessibilityLiveRegion="polite" style={styles.hint}>{t('Complete the sections you started before saving.')}</Text>}
    {snapshot.error && <Text accessibilityRole="alert" style={styles.error}>{t('Some details could not be saved. Retry to finish saving your changes.')}</Text>}
    <PrimaryButton label={snapshot.saving ? t('Saving…') : snapshot.error ? t('Retry save') : t('Save and finish')}
      disabled={snapshot.saving || snapshot.invalid} onPress={() => { void batch.store.submit().then(saved => { if (saved) onComplete(); }); }} />
  </>;
}
