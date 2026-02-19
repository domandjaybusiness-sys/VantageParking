import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { isAuthenticated } from '@/lib/auth';

function RootNavigator() {
  const { colorScheme } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key) return;

    async function checkAuth() {
      const authed = await isAuthenticated();
      const inAuthGroup = segments[0] === '(auth)';
      
      // Allow tabs without auth; only redirect authenticated users out of auth screens
      if (authed && inAuthGroup && segments.length > 1) {
        // If authenticated and in auth screens (not counting initial load), go to tabs
        console.log('✅ Already authenticated, redirecting to tabs');
        router.replace('/(tabs)');
      }
    }
    
    checkAuth();
  }, [segments]);

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-listing" options={{ presentation: 'modal', headerShown: true, title: 'Add New Spot' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}
