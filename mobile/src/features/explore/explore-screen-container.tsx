import { useRef, useState, type ComponentRef, type PropsWithChildren } from 'react';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BevveTheme as theme } from '@/constants/theme';
import { Logo } from '@/components/logo';
import { useTranslation } from '@/localization/language-provider';
import { VenueMap } from './venue-map';
import type { VenueMapPin } from './venue-map-data';

type Props = PropsWithChildren<{
  pins: readonly VenueMapPin[];
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

// A single scroll surface lets an upward swipe on the cards naturally move the
// map offscreen. A full viewport of sheet content also covers the map when empty.
export function ExploreScreenContainer({ pins, children, contentContainerStyle, refreshing = false, onRefresh }: Props) {
  const { t } = useTranslation();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [height, setHeight] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [mapInteracting, setMapInteracting] = useState(false);
  const mapHeight = height / 2;

  return <View style={styles.screen}>
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.scrollContent}
        onLayout={event => setHeight(event.nativeEvent.layout.height)}
        scrollEnabled={!mapInteracting}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
        showsVerticalScrollIndicator={false} scrollEventThrottle={16}
        onScroll={event => setExpanded(mapHeight > 0 && event.nativeEvent.contentOffset.y >= mapHeight - 1)}
        alwaysBounceVertical={onRefresh ? true : undefined}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
          tintColor={theme.colors.purpleLight} colors={[theme.colors.purpleLight]}
          progressBackgroundColor={theme.colors.surface} /> : undefined}>
        <View style={{ height: mapHeight }}>
          {height > 0 && <VenueMap pins={pins} onInteractionChange={setMapInteracting}
            onSelect={barId => router.push({ pathname: '/bars/[barId]', params: { barId } })} />}
          <View pointerEvents="none" style={styles.brand}><Logo /></View>
          {pins.some(pin => pin.sample) && <View pointerEvents="none" style={styles.sampleBadge}>
            <Text style={styles.sampleText}>{t('Sample locations are illustrative')}</Text>
          </View>}
        </View>
        <View style={[styles.sheet, { minHeight: height }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Expand bar list')}
            onPress={() => scroll.current?.scrollTo({ y: mapHeight, animated: true })} style={styles.handleButton}>
            <View style={styles.handle} />
          </Pressable>
          <View style={contentContainerStyle}>{children}</View>
        </View>
      </ScrollView>
      {expanded && <Pressable accessibilityRole="button" accessibilityLabel={t('Show map')}
        onPress={() => scroll.current?.scrollTo({ y: 0, animated: true })}
        style={({ pressed }) => [styles.showMap, pressed && styles.pressed]}>
        <Text style={styles.showMapText}>{t('Show map')}</Text>
      </Pressable>}
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  safeArea: { flex: 1, width: '100%', maxWidth: theme.layout.maxWidth, alignSelf: 'center' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  sheet: { backgroundColor: theme.colors.background, borderTopLeftRadius: theme.radii.panel, borderTopRightRadius: theme.radii.panel },
  handleButton: { height: 44, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.textSubtle },
  brand: { position: 'absolute', top: 16, left: 16, paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radii.button, backgroundColor: theme.colors.imageBadge },
  sampleBadge: { position: 'absolute', bottom: 26, left: 12, padding: 8, borderRadius: theme.radii.sm, backgroundColor: theme.colors.imageBadge },
  sampleText: { fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: 10 },
  showMap: { position: 'absolute', bottom: 16, alignSelf: 'center', minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', borderRadius: theme.radii.pill, backgroundColor: theme.colors.purpleButton, borderColor: theme.colors.purpleLight, borderWidth: 1 },
  showMapText: { fontFamily: theme.fonts.bodyBold, fontSize: 13, color: theme.colors.text },
  pressed: { opacity: 0.8 },
});
