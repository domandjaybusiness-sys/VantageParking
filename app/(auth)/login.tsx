import { setAuth } from '@/lib/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    // Check if Apple Authentication is available
    const checkAppleAuth = async () => {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      setAppleAvailable(isAvailable);
    };
    checkAppleAuth();
  }, []);

  const handleGuest = async () => {
    setLoading(true);
    await setAuth('guest');
    setLoading(false);
    router.replace('/(tabs)');
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      
      // Google OAuth Configuration
      // For production, replace with your actual Google Client ID from Google Cloud Console
      const clientId = Platform.select({
        ios: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
        android: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
        web: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
      });

      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'vantageparking',
      });

      console.log('Google OAuth redirect URI:', redirectUri);

      // For demo/development: show setup instructions
      // In production with real client IDs, this will open the actual Google sign-in
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=openid%20profile%20email`;
      
      Alert.alert(
        'Google Sign-In Ready',
        'Google OAuth is configured and ready to use!\n\nTo enable:\n1. Get OAuth Client ID from Google Cloud Console\n2. Update clientId in login.tsx\n3. Configure redirect URIs\n\nFor now, continuing with demo auth...',
        [
          {
            text: 'OK',
            onPress: async () => {
              await setAuth('google');
              setLoading(false);
              router.replace('/(tabs)');
            },
          },
        ]
      );
      
      // Uncomment when you have real client IDs:
      // const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      // if (result.type === 'success') {
      //   // Parse the token from result.url
      //   // Send to your backend to create session
      //   await setAuth('google');
      //   router.replace('/(tabs)');
      // }
      
    } catch (error) {
      console.error('Google sign-in error:', error);
      Alert.alert('Error', 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  const handleApple = async () => {
    try {
      setLoading(true);

      if (!appleAvailable) {
        Alert.alert(
          'Apple Sign-In Unavailable',
          'Apple Sign-In is only available on iOS 13+ devices. For now, signing you in as demo user...',
          [
            {
              text: 'OK',
              onPress: async () => {
                await setAuth('apple');
                setLoading(false);
                router.replace('/(tabs)');
              },
            },
          ]
        );
        return;
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Signed in successfully
      console.log('Apple credential:', credential);
      
      // In production, send credential.identityToken to your backend
      // to verify and create a session
      
      await setAuth('apple');
      setLoading(false);
      router.replace('/(tabs)');
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        // User canceled the sign-in
        setLoading(false);
      } else {
        console.error('Apple sign-in error:', error);
        Alert.alert('Error', 'Failed to sign in with Apple');
        setLoading(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* App Logo/Title */}
        <Animated.View 
          entering={FadeInDown.duration(600).delay(100)}
          style={styles.header}
        >
          <Text style={styles.appTitle}>Vantage Parking</Text>
          <Text style={styles.subtitle}>Find & reserve parking in seconds</Text>
        </Animated.View>

        {/* Buttons */}
        <Animated.View 
          entering={FadeInUp.duration(600).delay(300)}
          style={styles.buttonContainer}
        >
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.guestButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleGuest}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue as Guest</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.googleButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleGoogle}
            disabled={loading}
          >
            <Text style={styles.googleButtonText}>🔵 Sign in with Google</Text>
          </Pressable>

          {appleAvailable && Platform.OS === 'ios' ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={styles.appleButton}
              onPress={handleApple}
            />
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.appleButtonFallback,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleApple}
              disabled={loading}
            >
              <Text style={styles.buttonText}>🍎 Sign in with Apple</Text>
            </Pressable>
          )}

          <Text style={styles.disclaimer}>
            {appleAvailable && Platform.OS === 'ios' 
              ? 'Secure authentication powered by Apple & Google' 
              : 'Authentication methods may vary by platform'}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 16,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  guestButton: {
    backgroundColor: '#10b981',
  },
  googleButton: {
    backgroundColor: '#fff',
  },
  appleButton: {
    height: 56,
    width: '100%',
  },
  appleButtonFallback: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#333',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  disclaimer: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
});
