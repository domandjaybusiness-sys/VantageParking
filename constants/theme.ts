/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

// Primary brand green used across the app
const brandGreen = '#10b981';

export const Colors = {
  light: {
    // basic tokens (keep old keys for compatibility)
    text: '#11181C',
    background: '#ffffff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,

    // design-system tokens
    primary: brandGreen,
    backgroundCard: '#f8fafc',
    textSecondary: '#64748b',
    border: '#e6eef6',
    badgeConfirmed: '#10b981',
    badgePending: '#f59e0b',
    badgeCancelled: '#ef4444',
  },
  dark: {
    // basic tokens (keep old keys for compatibility)
    text: '#ECEDEE',
    background: '#0b1220',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,

    // design-system tokens
    primary: brandGreen,
    backgroundCard: '#0f172a',
    textSecondary: '#94a3b8',
    border: '#111827',
    badgeConfirmed: '#10b981',
    badgePending: '#f59e0b',
    badgeCancelled: '#ef4444',
  },
};

export const Design = {
  radius: 14,
  buttonHeight: 52,
  spacing: {
    xs: 6,
    sm: 8,
    md: 16,
    lg: 24,
  },
  fontSizes: {
    title: 28,
    subtitle: 18,
    body: 16,
    caption: 12,
  },
};

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
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
