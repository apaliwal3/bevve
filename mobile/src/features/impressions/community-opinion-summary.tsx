import { StyleSheet, Text, View } from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';
import { useTranslation } from '@/localization/language-provider';
import type { Translate } from '@/localization/translation';
import type { CommunityOpinionView } from './community-opinion-presentation';

export function communityOpinionLabel(opinion: CommunityOpinionView, t: Translate): string {
  if (opinion.status === 'unavailable') return t('Community opinions are unavailable in this demo.');
  if (opinion.status === 'empty') return t('No opinions yet');
  return t('{percentage}% liked it · {count} opinions', { percentage: opinion.percentage, count: opinion.count });
}

export function CommunityOpinionSummary({ opinion, compact = false }: { opinion: CommunityOpinionView; compact?: boolean }) {
  const { t, format } = useTranslation();
  return (
    <View accessible accessibilityLabel={communityOpinionLabel(opinion, t)} style={[styles.summary, compact && styles.compact]}>
      <Text style={styles.label}>{t('Community opinion')}</Text>
      {opinion.status === 'unavailable' ? <Text style={styles.meta}>{compact ? t('Unavailable in demo') : t('Community opinions are unavailable in this demo.')}</Text>
        : opinion.status === 'empty' ? <Text style={styles.meta}>{t('No opinions yet')}</Text>
          : <>
            <Text style={[styles.value, compact && styles.compactValue]}>{t('{percentage}% liked it', { percentage: format.number(opinion.percentage) })}</Text>
            <Text style={styles.meta}>{t('{count} opinions', { count: opinion.count })}</Text>
          </>}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: theme.spacing.xs, flexShrink: 1 },
  compact: { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.md, backgroundColor: theme.colors.imageBadge },
  label: { fontFamily: theme.fonts.bodyBold, color: theme.colors.purpleLight, fontSize: 10 },
  value: { fontFamily: theme.fonts.heading, color: theme.colors.text, fontSize: 20 },
  compactValue: { fontSize: 12 },
  meta: { fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: 11, lineHeight: 17 },
});
