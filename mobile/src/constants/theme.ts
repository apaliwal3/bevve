import { Platform } from 'react-native';

// dark-blue-theme.css, including its final translucent ivory overrides.
// Legacy purple names remain aliases for the cream brand accents.
export const BevveTheme = {
  colors: {
    background: '#253C5D',
    backgroundDeep: '#071426',
    welcomeBackground: '#071426',
    surface: 'rgba(242, 239, 223, 0.16)',
    surfaceRaised: 'rgba(242, 239, 223, 0.22)',
    surfaceInset: 'rgba(242, 239, 223, 0.10)',
    control: 'rgba(242, 239, 223, 0.16)',
    text: '#F5F9FF',
    textSecondary: '#CCDBEB',
    textMuted: '#9EB4CC',
    textSubtle: '#829AB4',
    onAccent: '#233D60',
    heroAccent: '#E9E0D2',
    error: '#fda4af',
    errorBorder: '#fb7185',
    purple: '#F2EFDF',
    purpleButton: 'rgba(242, 239, 223, 0.82)',
    purpleButtonPressed: '#F2EFDF',
    purpleLight: '#F2EFDF',
    purpleText: '#F2EFDF',
    purpleTint: 'rgba(242, 239, 223, 0.14)',
    purpleBorder: 'rgba(242, 239, 223, 0.32)',
    accentBorder: 'rgba(242, 239, 223, 0.58)',
    border: 'rgba(242, 239, 223, 0.32)',
    navigation: 'rgba(43, 71, 109, 0.96)',
    success: '#34d399',
    successTint: 'rgba(52, 211, 153, 0.10)',
    successBorder: 'rgba(52, 211, 153, 0.20)',
    star: '#fde68a',
    starTint: 'rgba(250, 204, 21, 0.15)',
    overlayBackdrop: 'rgba(3, 7, 18, 0.72)',
    overlaySurface: '#2D4A72',
    imageBadge: 'rgba(4, 13, 25, 0.72)',
    photoShade: 'rgba(4, 8, 18, 0.2)',
    photoShadeMiddle: 'rgba(9, 14, 26, 0.18)',
    photoPurple: 'rgba(242, 231, 209, 0.315)',
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
  radii: { sm: 8, md: 13, button: 15, card: 20, panel: 22, hero: 34, pill: 999 },
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
