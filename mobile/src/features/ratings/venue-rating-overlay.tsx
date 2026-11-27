import { ContributionBatch, SaveContributionsButton } from '@/features/contributions/contribution-batch';
import { OptionalContributionCard } from '@/features/contributions/optional-contribution-card';
import { ratingOverlayStyles as styles } from './rating-overlay-styles';
import { useTranslation } from '@/localization/language-provider';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import type { Venue } from '@/types/venue';
import { BathroomReviewForm } from '@/features/contributions/bathroom-review-form';
import { CrowdReportForm } from '@/features/contributions/crowd-report-form';
import { DrinkPriceForm } from '@/features/contributions/drink-price-form';
import { SpokenLanguagesForm } from '@/features/contributions/spoken-languages-form';
import { SafetyInformationForm } from '@/features/contributions/safety-information-form';
import type { PlainTranslationKey } from '@/localization/translation';
import { useVenueRatingJourney } from '@/features/comparisons/personal-comparisons-provider';
import { PreferenceVenueCard } from '@/features/comparisons/preference-venue-card';
import { createSessionSubmissionId } from '@/features/contributions/contribution-state';
import { ImpressionSelector, impressionLabels } from '@/features/impressions/impression-selector';
import type { Impression } from '@/features/impressions/impression-state';

import { useVenueContributions, useVenueExtras } from './venue-ratings-provider';

type OptionalActionId = 'crowd' | 'bathrooms' | 'prices' | 'languages' | 'safety';
const optionalActions: {
  id: OptionalActionId;
  title: PlainTranslationKey;
  hint: PlainTranslationKey;
  icon: AppIconName | 'euro';
}[] = [
  { id: 'crowd', title: 'Report crowd', hint: 'Share the live vibe', icon: 'crowd' },
  { id: 'bathrooms', title: 'Rate bathrooms', hint: 'Cleanliness, accessibility and waiting time', icon: 'bathroom' },
  { id: 'prices', title: 'Update drink prices', hint: 'Suggest menu prices', icon: 'euro' },
  { id: 'languages', title: 'Spoken languages', hint: 'Languages spoken by staff', icon: 'languages' },
  { id: 'safety', title: 'Safety information', hint: 'Public information and private reports', icon: 'safety' },
];

type VenueRatingOverlayProps = { venue: Venue; onClose: () => void };

// Mounted only while open: unsaved first-time selections are discarded on dismissal.
export function VenueRatingOverlay({ venue, onClose }: VenueRatingOverlayProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const journey = useVenueRatingJourney(venue.id);
  const { open, close, available } = journey;
  const { ownCrowdReport, ownBathroomReview, submitCrowdReport, saveBathroomReview } = useVenueContributions(venue.id);
  const { drinks, languages, pendingLanguages, demoSafetyNotes, submitDrinkPrice, suggestLanguage, submitIncident } = useVenueExtras(venue.id);
  const [draftImpression, setDraftImpression] = useState<Impression | null>(journey.impression);
  const [closingSnapshot, setClosingSnapshot] = useState<typeof journey | null>(null);
  const view = closingSnapshot ?? journey;
  const unchangedImpression = view.impression !== null && draftImpression === view.impression;
  const [isClosing, setIsClosing] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const mounted = useRef(true);
  const closing = useRef(false);
  const contributionBusy = useRef(false);
  const onContributionSaving = useCallback((value: boolean) => { contributionBusy.current = value; }, []);
  const reduceMotion = useRef(false);
  const overlayId = useRef<string | null>(null);
  const authority = useRef<typeof journey.token>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const top = Math.max(72, insets.top + theme.spacing.lg);
  const bottom = Math.max(theme.spacing.xxl, insets.bottom + theme.spacing.lg);
  // Keep even the first animation frame below the camera's safe area.
  const entryOffset = -Math.min(32, top - insets.top);

  useEffect(() => {
    mounted.current = true;
    const id = createSessionSubmissionId();
    overlayId.current = id;
    open(id);
    return () => {
      mounted.current = false;
      authority.current = null;
      progress.stopAnimation();
      close(id);
    };
  }, [progress, open, close]);

  useEffect(() => {
    authority.current = journey.token;
  }, [journey.token]);

  useEffect(() => {
    if (!available) onClose();
  }, [available, onClose]);

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [journey.step, journey.prompt?.token.round]);

  async function animateIn() {
    try {
      reduceMotion.current = await AccessibilityInfo.isReduceMotionEnabled();
    } catch {
      reduceMotion.current = false;
    }
    if (!mounted.current || closing.current) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion.current ? 0 : 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }

  function requestClose() {
    if (closing.current || contributionBusy.current || !mounted.current) return;
    closing.current = true;
    setClosingSnapshot(journey);
    setIsClosing(true);
    if (overlayId.current) close(overlayId.current);
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: 0,
      duration: reduceMotion.current ? 0 : 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished && mounted.current) onClose();
    });
  }

  function canAct() {
    return mounted.current && !closing.current && journey.token !== null &&
      authority.current?.overlayId === journey.token.overlayId &&
      authority.current.catalogRevision === journey.token.catalogRevision;
  }

  function continueJourney(resume = true) {
    if (draftImpression !== null && canAct()) journey.save(draftImpression, resume);
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={() => { void animateIn(); }}
      onRequestClose={requestClose}>
      <View style={[styles.root, {
        paddingTop: top,
        paddingBottom: bottom,
        paddingLeft: Math.max(theme.spacing.lg, insets.left + theme.spacing.sm),
        paddingRight: Math.max(theme.spacing.lg, insets.right + theme.spacing.sm),
      }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]} />
        <Pressable accessible={false} disabled={isClosing} style={StyleSheet.absoluteFill} onPress={requestClose} />
        <Animated.View
          accessibilityViewIsModal
          onAccessibilityEscape={requestClose}
          pointerEvents={isClosing ? 'none' : 'auto'}
          style={[styles.panel, {
            maxHeight: Math.max(0, height - top - bottom),
            opacity: progress,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [entryOffset, 0] }) }],
          }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>{t('BAR ACTIONS')}</Text>
              <Text accessibilityRole="header" style={styles.venueName}>{venue.name}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Close bar actions")}
              onPress={requestClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <AppIcon name="close" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            ref={scroll}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            {view.step === 'impression' ? (
              <View style={styles.ratingCard}>
                <Text accessibilityRole="header" style={styles.question}>{t('How was it?')}</Text>
                <ImpressionSelector value={draftImpression} onChange={(impression) => { if (canAct()) setDraftImpression(impression); }} disabled={isClosing || !journey.token} />
                {view.noOpponents && <Text style={styles.description}>{t('No other experienced bars are available to compare yet.')}</Text>}
                {unchangedImpression ? (
                  <>
                    {view.pending ? <PrimaryButton label={t('Resume comparisons')} disabled={isClosing || !journey.token}
                      onPress={() => { if (canAct()) journey.resume(); }} />
                      : view.canCompareAgain && <PrimaryButton label={t('Compare this bar again')} disabled={isClosing || !journey.token}
                        onPress={() => { if (canAct()) journey.compareAgain(); }} />}
                    <PrimaryButton label={t('Continue to contributions')} variant="secondary" disabled={isClosing || !journey.token}
                      onPress={() => { if (canAct()) journey.continueToContributions(); }} />
                  </>
                ) : (
                  <>
                    <PrimaryButton label={view.pending ? t('Save and resume comparisons') : t('Save impression and continue')}
                      disabled={draftImpression === null || isClosing || !journey.token} onPress={() => continueJourney()} />
                    {view.pending && <PrimaryButton label={t('Save and continue to optional contributions')} variant="secondary"
                      disabled={draftImpression === null || isClosing || !journey.token} onPress={() => continueJourney(false)} />}
                  </>
                )}
              </View>
            ) : view.step === 'comparisons' && view.pair && view.progress ? (
              <>
                <Text accessibilityLiveRegion="polite" style={styles.eyebrow}>{t('Comparison {current} of {total}', { current: view.progress.current, total: view.progress.total })}</Text>
                <Text accessibilityRole="header" style={styles.question}>{t('Which would you rather revisit?')}</Text>
                <Text style={styles.description}>{t('Your personal choices are separate from your saved impression.')}</Text>
                {view.pair.map((option, index) => (
                  <PreferenceVenueCard key={option.id} venue={option} otherName={view.pair![index === 0 ? 1 : 0].name}
                    compact selected={false} faded={false} disabled={isClosing}
                    choiceHint={t('Save this personal preference')}
                    onChoose={() => { if (canAct()) journey.choose(option.id); }} />
                ))}
                <PrimaryButton label={t('Skip this comparison')} variant="secondary" disabled={isClosing} onPress={() => { if (canAct()) journey.skip(); }} />
                <PrimaryButton label={t('Skip remaining comparisons')} variant="secondary" disabled={isClosing} onPress={() => { if (canAct()) journey.skip(true); }} />
              </>
            ) : view.step === 'contributions' ? (
              <ContributionBatch onSavingChange={onContributionSaving}>
                <View style={styles.ratingCard}>
                  <Text style={styles.eyebrow}>{t('YOUR EXPERIENCE')}</Text>
                  {view.impression && <Text accessibilityLiveRegion="polite" style={styles.question}>{t(impressionLabels[view.impression])}</Text>}
                  <Text style={styles.description}>{t('Saved for this demo session.')}</Text>
                  {view.noOpponents && <Text style={styles.description}>{t('No other experienced bars are available to compare yet.')}</Text>}
                </View>
                <Text style={styles.description}>{t('All five contributions are optional. Fill in any cards, then save when you are done.')}</Text>
                {optionalActions.map((action) => (
                  <OptionalContributionCard key={action.id} titleKey={action.title} hintKey={action.hint} icon={action.icon} disabled={isClosing}>
                          {action.id === 'crowd' ? (
                            <CrowdReportForm
                              savedReport={ownCrowdReport}
                              disabled={isClosing}
                              onSubmit={(level) => { if (canAct()) submitCrowdReport(level); }}
                              onCancel={() => {}}
                            />
                          ) : action.id === 'bathrooms' ? (
                            <BathroomReviewForm
                              savedReview={ownBathroomReview}
                              disabled={isClosing}
                              onSubmit={(scores) => { if (canAct()) saveBathroomReview(scores); }}
                              onCancel={() => {}}
                            />
                          ) : action.id === 'prices' ? (
                            <DrinkPriceForm
                              prices={drinks}
                              disabled={isClosing}
                              onSubmit={(drinkId, cents) => { if (canAct()) submitDrinkPrice(drinkId, cents); }}
                              onCancel={() => {}}
                            />
                          ) : action.id === 'languages' ? (
                            <SpokenLanguagesForm
                              languages={languages}
                              pending={pendingLanguages}
                              disabled={isClosing}
                              onSubmit={(codes) => { if (canAct()) codes.forEach(code => suggestLanguage(code)); }}
                              onCancel={() => {}}
                            />
                          ) : (
                            <SafetyInformationForm
                              demoNotes={demoSafetyNotes}
                              disabled={isClosing}
                              onSubmit={(incident) => { if (canAct()) submitIncident(incident); }}
                              onCancel={() => {}}
                            />
                          )}
                  </OptionalContributionCard>
                ))}
                <SaveContributionsButton onComplete={requestClose} />
              </ContributionBatch>
            ) : <Text style={styles.description}>{t('Updating available venues…')}</Text>}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
