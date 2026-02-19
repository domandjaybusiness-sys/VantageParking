import { Colors } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

type ColorScheme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  colorScheme: 'light' | 'dark';
  themePreference: ColorScheme;
  setThemePreference: (theme: ColorScheme) => void;
  colors: typeof Colors.light;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@theme_preference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useSystemColorScheme() ?? 'dark';
  const [themePreference, setThemePreferenceState] = useState<ColorScheme>('auto');
  
  // Determine actual color scheme based on preference
  const colorScheme = themePreference === 'auto' ? systemColorScheme : themePreference;
  const colors = Colors[colorScheme];

  // Load theme preference from storage
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && (saved === 'light' || saved === 'dark' || saved === 'auto')) {
          setThemePreferenceState(saved as ColorScheme);
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      }
    })();
  }, []);

  // Save theme preference
  const setThemePreference = async (theme: ColorScheme) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
      setThemePreferenceState(theme);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  // Toggle between light and dark (ignoring auto)
  const toggleTheme = () => {
    const newTheme = colorScheme === 'light' ? 'dark' : 'light';
    setThemePreference(newTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        themePreference,
        setThemePreference,
        colors,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
