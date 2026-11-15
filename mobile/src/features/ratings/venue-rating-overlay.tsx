import { useEffect, useRef, useState } from 'react';
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

import type { StarRating } from './rating-state';
import { StarSelector } from './star-selector';
import { useVenueContributions, useVenueExtras, useVenueRating } from './venue-ratings-provider';

const ratingLabels: Record<StarRating, string> = {
  1: 'Disappointing',
  2: 'Mediocre',
  3: 'Decent',
  4: 'Really good',
  5: 'Incredible night',
};

type OptionalActionId = 'crowd' | 'bathrooms' | 'prices' | 'languages' | 'safety';
const optionalActions: {
  id: OptionalActionId;
  title: string;
  hint: string;
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
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { userRating, saveRating } = useVenueRating(venue);
  const { ownCrowdReport, ownBathroomReview, submitCrowdReport, saveBathroomReview } = useVenueContributions(venue.id);
  const { drinks, languages, pendingLanguages, demoSafetyNotes, submitDrinkPrice, suggestLanguage, submitIncident } = useVenueExtras(venue.id);
  const [draftRating, setDraftRating] = useState<StarRating | null>(userRating);
  const [expanded, setExpanded] = useState<Partial<Record<OptionalActionId, boolean>>>({});
  const [isClosing, setIsClosing] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const mounted = useRef(true);
  const closing = useRef(false);
  const reduceMotion = useRef(false);
  const top = Math.max(72, insets.top + theme.spacing.lg);
  const bottom = Math.max(theme.spacing.xxl, insets.bottom + theme.spacing.lg);
  // Keep even the first animation frame below the camera's safe area.
  const entryOffset = -Math.min(32, top - insets.top);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      progress.stopAnimation();
    };
  }, [progress]);

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
    if (closing.current) return;
    closing.current = true;
    setIsClosing(true);
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

  function saveFirstRating() {
    if (draftRating !== null && !closing.current) saveRating(draftRating);
  }

  function updateRating(rating: StarRating) {
    if (!closing.current) saveRating(rating);
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
              <Text style={styles.eyebrow}>{userRating === null ? 'RATE TO UNLOCK' : 'BAR ACTIONS & RATINGS'}</Text>
              <Text accessibilityRole="header" style={styles.venueName}>{venue.name}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close bar actions"
              onPress={requestClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <AppIcon name="close" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            {userRating === null ? (
              <View style={styles.ratingCard}>
                <Text style={styles.eyebrow}>★ REQUIRED STEP</Text>
                <Text accessibilityRole="header" style={styles.question}>How was {venue.name}?</Text>
                <Text style={styles.description}>Rate your overall experience from 1 to 5 stars to unlock the optional cards.</Text>
                <StarSelector value={draftRating} onChange={setDraftRating} disabled={isClosing} />
                <Text accessibilityLiveRegion="polite" style={styles.ratingCaption}>
                  {draftRating === null ? 'Choose a star rating' : `${draftRating} ★ · ${ratingLabels[draftRating]}`}
                </Text>
                <PrimaryButton label="Save rating and continue" disabled={draftRating === null || isClosing} onPress={saveFirstRating} />
              </View>
            ) : (
              <>
                <View style={styles.ratingCard}>
                  <View style={styles.ratingHeading}>
                    <Text style={styles.eyebrow}>YOUR OVERALL RATING</Text>
                    <Text accessibilityLiveRegion="polite" style={styles.ratingBadge}>{userRating}/5 ★</Text>
                  </View>
                  <Text accessibilityRole="header" style={styles.question}>How was {venue.name}?</Text>
                  <StarSelector value={userRating} onChange={updateRating} disabled={isClosing} />
                  <Text style={styles.description}>Saved for this session. Tap any star to update your rating.</Text>
                </View>
                <Text style={styles.description}>All five contributions are optional. Choose any card, or close when you are done.</Text>
                {optionalActions.map((action) => {
                  const isExpanded = expanded[action.id] === true;
                  return (
                    <View key={action.id} style={[styles.optionalCard, isExpanded && styles.expandedCard]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={action.title}
                        accessibilityState={{ expanded: isExpanded }}
                        disabled={isClosing}
                        onPress={() => setExpanded((previous) => ({ ...previous, [action.id]: !previous[action.id] }))}
                        style={({ pressed }) => [styles.cardSummary, pressed && styles.pressed]}>
                        <View style={styles.cardIcon}>
                          {action.icon === 'euro'
                            ? <Text style={styles.euro} accessible={false}>€</Text>
                            : <AppIcon name={action.icon} size={20} color={theme.colors.purpleLight} />}
                        </View>
                        <View style={styles.cardCopy}>
                          <Text style={styles.cardTitle}>{action.title}</Text>
                          <Text style={styles.hint}>{action.hint}</Text>
                        </View>
                        <View style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}>
                          <AppIcon name="chevron" size={16} color={theme.colors.purpleLight} />
                        </View>
                      </Pressable>
                      {isExpanded && (
                        <View style={styles.placeholder}>
                          {action.id === 'crowd' ? (
                            <CrowdReportForm
                              savedReport={ownCrowdReport}
                              disabled={isClosing}
                              onSubmit={(level) => { if (!closing.current) submitCrowdReport(level); }}
                              onCancel={() => setExpanded((previous) => ({ ...previous, crowd: false }))}
                            />
                          ) : action.id === 'bathrooms' ? (
                            <BathroomReviewForm
                              savedReview={ownBathroomReview}
                              disabled={isClosing}
                              onSubmit={(scores) => { if (!closing.current) saveBathroomReview(scores); }}
                              onCancel={() => setExpanded((previous) => ({ ...previous, bathrooms: false }))}
                            />
                          ) : action.id === 'prices' ? (
                            <DrinkPriceForm
                              prices={drinks}
                              disabled={isClosing}
                              onSubmit={(drinkId, cents) => { if (!closing.current) submitDrinkPrice(drinkId, cents); }}
                              onCancel={() => setExpanded((previous) => ({ ...previous, prices: false }))}
                            />
                          ) : action.id === 'languages' ? (
                            <SpokenLanguagesForm
                              languages={languages}
                              pending={pendingLanguages}
                              disabled={isClosing}
                              onSubmit={(code) => { if (!closing.current) suggestLanguage(code); }}
                              onCancel={() => setExpanded((previous) => ({ ...previous, languages: false }))}
                            />
                          ) : (
                            <SafetyInformationForm
                              demoNotes={demoSafetyNotes}
                              disabled={isClosing}
                              onSubmit={(incident) => { if (!closing.current) submitIncident(incident); }}
                              onCancel={() => setExpanded((previous) => ({ ...previous, safety: false }))}
                            />
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  backdrop: {
    backgroundColor: theme.colors.overlayBackdrop
  },
  panel: {
    width: '100%',
    maxWidth: 374,
    flexShrink: 1,
    borderRadius: theme.radii.panel,
    borderWidth: 1,
    borderColor: theme.colors.purpleBorder,
    backgroundColor: theme.colors.overlaySurface,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderColor: theme.colors.border
  },
  headerCopy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  eyebrow: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1
  },
  venueName: {
    color: theme.colors.text,
    fontFamily: theme.fonts.brand,
    fontSize: 21,
    lineHeight: 28
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceRaised
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.md
  },
  ratingCard: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.purpleBorder,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.purpleTint
  },
  question: {
    color: theme.colors.text,
    fontFamily: theme.fonts.brand,
    fontSize: 22,
    lineHeight: 29
  },
  description: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 19
  },
  ratingCaption: {
    color: theme.colors.star,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    textAlign: 'center'
  },
  ratingHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm
  },
  ratingBadge: {
    color: theme.colors.star,
    backgroundColor: theme.colors.starTint,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12
  },
  optionalCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden'
  },
  expandedCard: {
    borderColor: theme.colors.purpleBorder
  },
  cardSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    gap: theme.spacing.sm,
    padding: theme.spacing.md
  },
  cardIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.purpleTint
  },
  cardCopy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  cardTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14
  },
  hint: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 17
  },
  euro: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 19
  },
  placeholder: {
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm
  },
  pressed: {
    opacity: 0.7
  }
});
