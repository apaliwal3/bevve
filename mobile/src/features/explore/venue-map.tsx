import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTranslation } from '@/localization/language-provider';
import { mapSelection, type VenueMapPin } from './venue-map-data';
import { venueMapHtml } from './venue-map-html';

export type VenueMapProps = {
  pins: readonly VenueMapPin[];
  onSelect: (id: string) => void;
  onInteractionChange?: (interacting: boolean) => void;
};

export function VenueMap({ pins, onSelect, onInteractionChange }: VenueMapProps) {
  const { t } = useTranslation();
  const source = useMemo(() => ({ html: venueMapHtml(pins, {
    title: t('Map of bars'), empty: t('No bars to show on the map'), sample: t('Sample location'),
    unavailable: t('Map unavailable. Check your connection.'), open: t('View Bar Details'),
  }) }), [pins, t]);
  return <WebView
    accessibilityLabel={t('Map of bars')}
    source={source}
    style={styles.map}
    originWhitelist={['*']}
    scrollEnabled={false}
    nestedScrollEnabled
    bounces={false}
    onTouchStart={() => onInteractionChange?.(true)}
    onTouchEnd={() => onInteractionChange?.(false)}
    onTouchCancel={() => onInteractionChange?.(false)}
    setSupportMultipleWindows={false}
    onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
    onMessage={event => {
      const id = mapSelection(event.nativeEvent.data, pins);
      if (id) onSelect(id);
    }}
  />;
}

const styles = StyleSheet.create({ map: { flex: 1, backgroundColor: '#111827' } });
