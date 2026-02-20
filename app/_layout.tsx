import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { isAuthenticated } from '@/lib/auth';

function RootNavigator() {
  const { colorScheme } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!navigationState?.key) return;

    async function checkAuth() {
      const authed = await isAuthenticated();
      const inAuthGroup = segments[0] === '(auth)';
      
      if (!authed && !inAuthGroup) {
        console.log('🔒 Not authenticated, redirecting to login');
        router.replace('/(auth)/login');
        return;
      }

      if (authed && inAuthGroup && segments.length > 1) {
        console.log('✅ Already authenticated, redirecting to tabs');
        router.replace('/(tabs)');
      }

      setAuthChecked(true);
    }
    
    checkAuth();
  }, [navigationState?.key, router, segments]);

  if (!authChecked) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>V</Text>
        </View>
        <Text style={styles.splashTitle}>Vantage</Text>
        <ActivityIndicator size="small" color="#0f172a" />
      </View>
    );
  }

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search" options={{ presentation: 'modal', headerShown: true, title: 'Search Spots' }} />
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

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  splashTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
});
