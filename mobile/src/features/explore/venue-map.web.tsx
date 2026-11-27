import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '@/localization/language-provider';
import { BevveTheme as theme } from '@/constants/theme';
import { mapSelection, type VenueMapPin } from './venue-map-data';
import { venueMapHtml } from './venue-map-html';

export function VenueMap({ pins, onSelect }: { pins: readonly VenueMapPin[]; onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => venueMapHtml(pins, {
    title: t('Map of bars'), empty: t('No bars to show on the map'), sample: t('Sample location'),
    unavailable: t('Map unavailable. Check your connection.'), open: t('View Bar Details'),
  }, theme.colors), [pins, t]);
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || typeof event.data !== 'string') return;
      const id = mapSelection(event.data, pins);
      if (id) onSelect(id);
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [pins, onSelect]);
  return <iframe ref={frame} title={t('Map of bars')} srcDoc={html}
    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
    style={{ display: 'block', width: '100%', height: '100%', border: 0 }} />;
}
