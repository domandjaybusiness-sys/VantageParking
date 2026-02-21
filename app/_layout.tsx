import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { isAuthenticated } from '@/lib/auth';

function RootNavigator() {
  const { colorScheme } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [authChecked, setAuthChecked] = useState(false);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const bgFade = useRef(new Animated.Value(0)).current;
  const ringAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const logoPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1, duration: 700, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 700, easing: Easing.in(Easing.exp), useNativeDriver: true }),
      ])
    );

    const dotAnims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.25, duration: 450, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ])
      )
    );

    // rotation removed: no spinning text

    const bgLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bgFade, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(bgFade, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ])
    );

    const ringLoops = ringAnims.map((r, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 240),
          Animated.timing(r, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(r, { toValue: 0, duration: 600, easing: Easing.linear, useNativeDriver: true }),
        ])
      )
    );

    logoPulse.start();
    dotAnims.forEach((a) => a.start());
    bgLoop.start();
    ringLoops.forEach((r) => r.start());

    return () => {
      logoPulse.stop();
      dotAnims.forEach((a) => a.stop());
      bgLoop.stop();
      ringLoops.forEach((r) => r.stop());
    };
  }, [scaleAnim, dots, bgFade, ringAnims]);

  useEffect(() => {
    // Ensure splash displays for at least 2.5 seconds on cold start
    const MIN_SPLASH_MS = 2500; // between 2000-3000ms per request
    const t = setTimeout(() => setMinSplashDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

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

  if (!authChecked || !minSplashDone) {
    const bgOverlayOpacity = bgFade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });

    return (
      <View style={styles.splashContainerBlack}>
        <Animated.View style={[styles.bgOverlay, { opacity: bgOverlayOpacity }]} />

        <View style={styles.logoWrap}>
          {/* pulsing rings */}
          {ringAnims.map((r, i) => (
            <Animated.View
              key={`ring-${i}`}
              style={[
                styles.ring,
                {
                  transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] }) }],
                  opacity: r.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.18, 0] }),
                },
              ]}
            />
          ))}

          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Text style={styles.logoBig}>Vantage</Text>
          </Animated.View>
        </View>

        <View style={styles.loadingRow}>
          {dots.map((d, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                { opacity: d, transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }, { scale: d.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }) }] },
              ]}
            />
          ))}
        </View>
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
      <PaperProvider>
        <RootNavigator />
      </PaperProvider>
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
  splashContainerBlack: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    width: 220,
    height: 220,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#071028',
    zIndex: 0,
  },
  logoBig: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 2,
  },
  ring: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: '#78a9ff',
    backgroundColor: 'transparent',
    zIndex: -1,
  },
  loadingRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
    marginHorizontal: 6,
    opacity: 0.25,
  },
});
