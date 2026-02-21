import { setAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View, KeyboardAvoidingView } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      setLoading(false);
      Alert.alert('Login failed', error.message || 'Invalid email or password.');
      return;
    }

    if (data?.session?.user) {
      const user = data.session.user;
      await setAuth('email', {
        userId: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.user_metadata?.full_name || user.email,
      });
      setLoading(false);
      router.replace('/(tabs)');
    } else {
      setLoading(false);
    }
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
          const callbackUrl = 'url' in result ? result.url : undefined;

          if (callbackUrl) {
            const parsed = new URL(callbackUrl);
            const queryParams = new URLSearchParams(parsed.search);
            const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));

            const code = queryParams.get('code') ?? hashParams.get('code');
            const accessToken = queryParams.get('access_token') ?? hashParams.get('access_token');
            const refreshToken = queryParams.get('refresh_token') ?? hashParams.get('refresh_token');

            if (code) {
              const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
              if (exchangeError) {
                console.error('Code exchange error:', exchangeError);
              }
            } else if (accessToken && refreshToken) {
              const { error: setSessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (setSessionError) {
                console.error('Set session error:', setSessionError);
              }
            }
          }

          await new Promise(resolve => setTimeout(resolve, 400));
          
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
            Alert.alert('Sign-In Error', 'No session established. Verify Supabase redirect URLs include parkdemo://auth/callback.');
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
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        {/* App Logo/Title */}
        <Animated.View 
          entering={FadeInDown.duration(600).delay(100)}
          style={styles.header}
        >
          <View style={styles.logoContainer}>
            <Ionicons name="car-sport" size={40} color="#3b82f6" />
          </View>
          <Text style={styles.appTitle}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to manage your parking</Text>
        </Animated.View>

        {/* Buttons */}
        <Animated.View 
          entering={FadeInUp.duration(600).delay(300)}
          style={styles.buttonContainer}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@email.com"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.loginButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleEmailLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Log in</Text>
            )}
          </Pressable>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.googleButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleGoogle}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={20} color="#0f172a" style={styles.buttonIcon} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </Pressable>

          {appleAvailable && Platform.OS === 'ios' ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
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
              <Ionicons name="logo-apple" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Continue with Apple</Text>
            </Pressable>
          )}

          <Pressable onPress={handleCreateAccount} disabled={loading} style={styles.createAccountLink}>
            <Text style={styles.altText}>Don&apos;t have an account? <Text style={styles.altTextBold}>Sign up</Text></Text>
          </Pressable>

        </Animated.View>
      </View>
    </KeyboardAvoidingView>
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
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#1e293b',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#fff',
    fontSize: 16,
  },
  button: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  loginButton: {
    backgroundColor: '#3b82f6',
    marginTop: 8,
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
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748b',
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: '600',
  },
  createAccountLink: {
    marginTop: 16,
    padding: 8,
  },
  altText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  altTextBold: {
    color: '#3b82f6',
    fontWeight: '700',
  },
});
