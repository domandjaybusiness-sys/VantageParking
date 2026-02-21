import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { isAuthenticated } from '@/lib/auth';

function RootNavigator() {
  const { colorScheme } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [authChecked, setAuthChecked] = useState(false);
  const [minSplashDone, setMinSplashDone] = useState(false);
  
  const pScale = useRef(new Animated.Value(0)).current;
  const gateRotation = useRef(new Animated.Value(0)).current;
  const carTranslateX = useRef(new Animated.Value(-250)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      // 1. Pop up the P sign
      Animated.spring(pScale, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.delay(200),
      // 2. Open the gate
      Animated.timing(gateRotation, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      // 3. Car drives in
      Animated.timing(carTranslateX, {
        toValue: 100, // Stop position
        duration: 700,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      // 4. Text fades in
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Idle pulse for the P sign
      Animated.loop(
        Animated.sequence([
          Animated.timing(pScale, { toValue: 1.05, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pScale, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    });
  }, [pScale, gateRotation, carTranslateX, textOpacity, textTranslateY]);

  useEffect(() => {
    // Ensure splash displays for at least 3 seconds on cold start to show the animation
    const MIN_SPLASH_MS = 3000; 
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
    const gateRotateInterpolate = gateRotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '90deg'],
    });

    return (
      <View style={styles.splashContainerBlack}>
        <View style={styles.animationContainer}>
          
          {/* Parking Sign */}
          <Animated.View style={[styles.pSignContainer, { transform: [{ scale: pScale }] }]}>
            <Text style={styles.pSignText}>P</Text>
          </Animated.View>

          {/* Gate and Car Container */}
          <View style={styles.roadContainer}>
            {/* Barrier Gate Base */}
            <View style={styles.gateBase} />
            
            {/* Barrier Gate Arm (Pivot) */}
            <Animated.View style={[styles.gatePivot, { transform: [{ rotate: gateRotateInterpolate }] }]}>
              <View style={styles.gateArm} />
            </Animated.View>
            
            {/* Car */}
            <Animated.View style={[styles.carContainer, { transform: [{ translateX: carTranslateX }] }]}>
              <Ionicons name="car-sport" size={56} color="#fff" />
            </Animated.View>
            
            {/* Road Line */}
            <View style={styles.roadLine} />
          </View>

          {/* Brand Text */}
          <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textTranslateY }], alignItems: 'center', marginTop: 20 }}>
            <Text style={styles.logoBig}>Vantage</Text>
            <Text style={styles.logoSub}>PARKING</Text>
          </Animated.View>

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
    backgroundColor: '#0f172a', // Dark slate for a modern asphalt look
    alignItems: 'center',
    justifyContent: 'center',
  },
  animationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  pSignContainer: {
    width: 72,
    height: 72,
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    marginBottom: 50,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  pSignText: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '900',
  },
  roadContainer: {
    width: 240,
    height: 80,
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  gateBase: {
    position: 'absolute',
    right: 40,
    bottom: 0,
    width: 14,
    height: 45,
    backgroundColor: '#94a3b8',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    zIndex: 2,
  },
  gatePivot: {
    position: 'absolute',
    right: 47, // Center of the base (40 + 14/2)
    bottom: 35, // Near the top of the base
    width: 0,
    height: 0,
    zIndex: 3,
  },
  gateArm: {
    position: 'absolute',
    right: -4, // Extend slightly past the pivot
    top: -4, // Center vertically on pivot
    width: 140,
    height: 8,
    backgroundColor: '#ef4444',
    borderRadius: 4,
  },
  carContainer: {
    position: 'absolute',
    left: 0,
    bottom: 4,
    zIndex: 1,
  },
  roadLine: {
    position: 'absolute',
    bottom: 0,
    left: -40,
    right: -40,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
  },
  logoBig: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 2,
  },
  logoSub: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 6,
    marginTop: 4,
  },
});
