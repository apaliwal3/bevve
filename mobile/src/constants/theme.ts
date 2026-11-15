import { Platform } from 'react-native';

// Approved Figma palette. bevve uses the same dark theme in both OS modes.
export const BevveTheme = {
  colors: {
    background: '#111827',
    backgroundDeep: '#090e1a',
    welcomeBackground: '#0b1220',
    surface: '#1f2937',
    surfaceRaised: '#263244',
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    textSubtle: '#64748b',
    purple: '#8b5cf6',
    purpleLight: '#a78bfa',
    purpleText: '#ddd6fe',
    purpleTint: 'rgba(139, 92, 246, 0.15)',
    purpleBorder: 'rgba(167, 139, 250, 0.4)',
    border: 'rgba(148, 163, 184, 0.14)',
    success: '#34d399',
    star: '#fde68a',
    imageBadge: 'rgba(8, 13, 23, 0.82)',
    photoShade: 'rgba(4, 8, 18, 0.2)',
    photoShadeMiddle: 'rgba(9, 14, 26, 0.18)',
    photoPurple: 'rgba(76, 29, 149, 0.3)',
    transparent: 'transparent',
  },
  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    xxl: 24,
    xxxl: 32,
    huge: 64,
  },
  radii: { sm: 8, md: 13, button: 15, card: 20, hero: 34, pill: 999 },
  fonts: {
    body: 'DMSans-Regular',
    bodyBold: 'DMSans-Bold',
    heading: 'Manrope-Bold',
    brand: 'Manrope-ExtraBold',
  },
  layout: { maxWidth: 480, buttonMinHeight: 50 },
} as const;

const darkColors = {
  text: BevveTheme.colors.text,
  background: BevveTheme.colors.background,
  backgroundElement: BevveTheme.colors.surface,
  backgroundSelected: BevveTheme.colors.surfaceRaised,
  textSecondary: BevveTheme.colors.textMuted,
};

// Keep starter components compatible while new components use BevveTheme directly.
export const Colors = { light: darkColors, dark: darkColors } as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'system-ui',
    serif: 'Georgia',
    rounded: 'system-ui',
    mono: 'monospace',
  },
});

export const Spacing = {
  half: BevveTheme.spacing.xxs,
  one: BevveTheme.spacing.xs,
  two: BevveTheme.spacing.sm,
  three: BevveTheme.spacing.lg,
  four: BevveTheme.spacing.xxl,
  five: BevveTheme.spacing.xxxl,
  six: BevveTheme.spacing.huge,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
