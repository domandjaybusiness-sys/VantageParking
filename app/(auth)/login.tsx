import { setAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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

  const handleCreateAccount = () => {
    router.push('/(auth)/signup');
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      
      console.log('🔵 Starting Google Sign-In...');
      
      // Use Supabase Auth with Google provider
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'parkdemo://auth/callback',
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google OAuth error:', error);
        
        // Show helpful error message
        Alert.alert(
          'Google Sign-In Setup Required',
          'To use Google Sign-In, you need to:\n\n' +
          '1. Go to Google Cloud Console\n' +
          '2. Configure OAuth Consent Screen\n' +
          '3. Set app to "Testing" mode\n' +
          '4. Add your email as a test user\n\n' +
          `Error: ${error.message}`,
          [{ text: 'OK', style: 'cancel', onPress: () => setLoading(false) }]
        );
        return;
      }

      if (data?.url) {
        console.log('🔵 Opening OAuth URL:', data.url);
        
        // Open the OAuth URL in browser
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          'parkdemo://auth/callback'
        );

        console.log('🔵 OAuth result:', result);

        if (result.type === 'success') {
          // Extract the session from the URL
          // Wait a moment for Supabase to process the session
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Get the current session
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('Session error:', sessionError);
            Alert.alert('Error', 'Failed to establish session');
            setLoading(false);
            return;
          }

          if (sessionData?.session) {
            const user = sessionData.session.user;
            console.log('✅ User authenticated:', user.email);
            
            // Save auth state
            await setAuth('google', {
              userId: user.id,
              email: user.email,
              name: user.user_metadata?.name || user.user_metadata?.full_name || user.email,
            });
            
            setLoading(false);
            router.replace('/(tabs)');
          } else {
            console.log('No session found');
            Alert.alert('Error', 'No session established');
            setLoading(false);
          }
        } else if (result.type === 'cancel') {
          console.log('User canceled OAuth');
          setLoading(false);
        } else {
          console.log('OAuth failed or dismissed');
          setLoading(false);
        }
      }
      
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      Alert.alert(
        'Sign-In Error',
        error.message || 'Failed to sign in with Google. Please try again.',
        [{ text: 'OK', style: 'cancel', onPress: () => setLoading(false) }]
      );
    }
  };

  const handleApple = async () => {
    try {
      setLoading(true);

      if (!appleAvailable) {
        Alert.alert(
          'Apple Sign-In Unavailable',
          'Apple Sign-In is only available on iOS 13+ devices.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('🍎 Apple credential received:', credential);
      
      // Sign in with Supabase using Apple identity token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
      });

      if (error) {
        console.error('Apple sign-in error:', error);
        Alert.alert('Error', error.message);
        setLoading(false);
        return;
      }

      if (data?.user) {
        console.log('✅ Apple user authenticated:', data.user.email);
        
        await setAuth('apple', {
          userId: data.user.id,
          email: data.user.email,
          name: credential.fullName?.givenName || data.user.email,
        });
        
        setLoading(false);
        router.replace('/(tabs)');
      }
      
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        console.log('User canceled Apple sign-in');
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
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🚗</Text>
          </View>
          <Text style={styles.appTitle}>Vantage</Text>
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
              styles.createButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleCreateAccount}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Create account</Text>
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
            <Text style={styles.googleButtonText}>Sign up with Google</Text>
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
              <Text style={styles.buttonText}>Sign up with Apple</Text>
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
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  logoIcon: {
    fontSize: 40,
  },
  appTitle: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -1,
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
  createButton: {
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
    fontSize: 16,
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
