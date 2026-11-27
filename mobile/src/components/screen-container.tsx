import type { PropsWithChildren } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { BevveTheme as theme } from '@/constants/theme';

type ScreenContainerProps = PropsWithChildren<{
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

export function ScreenContainer({
  children,
  edges = ['top', 'right', 'bottom', 'left'],
  style,
  contentContainerStyle,
  refreshing = false,
  onRefresh,
}: ScreenContainerProps) {
  return (
    <View style={[styles.container, style]}>
      <SafeAreaView edges={edges} style={styles.safeArea}>
        <ScrollView
          alwaysBounceVertical={onRefresh ? true : undefined}
          refreshControl={onRefresh ? <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.purpleLight}
            colors={[theme.colors.purpleLight]}
            progressBackgroundColor={theme.colors.surface}
          /> : undefined}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, contentContainerStyle]}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  safeArea: { flex: 1, width: '100%', maxWidth: theme.layout.maxWidth, alignSelf: 'center' },
  content: { flexGrow: 1 },
});
