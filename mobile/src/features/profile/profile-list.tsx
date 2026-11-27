import type { ReactElement } from 'react';
import { FlatList, StyleSheet, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BevveTheme as theme } from '@/constants/theme';

// One virtualized scroll surface owns both the header and the feed. Rows have
// variable heights for Dynamic Type; no estimated fixed layout or nested scroll.
export function ProfileList<T>({ data, renderItem, keyExtractor, header, empty, refreshing = false, onRefresh, secondary = false }: {
  data: readonly T[]; renderItem: ListRenderItem<T>; keyExtractor: (item: T) => string;
  header: ReactElement; empty?: ReactElement | null; refreshing?: boolean; onRefresh?: () => void; secondary?: boolean;
}) {
  return <SafeAreaView edges={secondary ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']} style={styles.screen}>
    <FlatList data={data} renderItem={renderItem} keyExtractor={keyExtractor}
      ListHeaderComponent={header} ListEmptyComponent={empty ?? undefined} contentContainerStyle={styles.content}
      refreshing={refreshing} onRefresh={onRefresh} initialNumToRender={10} windowSize={7}
      keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: theme.layout.maxWidth, alignSelf: 'center', backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, flexGrow: 1 },
});
