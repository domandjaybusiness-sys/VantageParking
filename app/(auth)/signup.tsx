import { setAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

WebBrowser.maybeCompleteAuthSession();

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSignupDisabled, setEmailSignupDisabled] = useState(false);

  const handleGoogleSignup = async () => {
    try {
      setLoading(true);

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
        Alert.alert('Google Sign Up Failed', error.message || 'Could not start Google sign up.');
        setLoading(false);
        return;
      }

      if (!data?.url) {
        Alert.alert('Google Sign Up Failed', 'Could not open Google sign up.');
        setLoading(false);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, 'parkdemo://auth/callback');

      if (result.type !== 'success') {
        setLoading(false);
        return;
      }

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

      await new Promise((resolve) => setTimeout(resolve, 400));

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session) {
        Alert.alert(
          'Google Sign Up Failed',
          'Could not complete your Google session. Check Supabase redirect URLs include parkdemo://auth/callback.'
        );
        setLoading(false);
        return;
      }

      const oauthUser = sessionData.session.user;
      await setAuth('google', {
        userId: oauthUser.id,
        email: oauthUser.email,
        name: oauthUser.user_metadata?.name || oauthUser.user_metadata?.full_name || oauthUser.email,
      });

      setLoading(false);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Google Sign Up Failed', error?.message || 'Please try again.');
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Please enter an email and password.');
      return;
    }

    setEmailSignupDisabled(false);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        data: {
          name: name.trim() || undefined,
        },
      },
    });

    if (error) {
      setLoading(false);
      const message = error.message || 'Unable to create your account.';

      if (message.toLowerCase().includes('email signups are disabled')) {
        setEmailSignupDisabled(true);
        Alert.alert(
          'Email Signups Disabled',
          'Enable Email provider in Supabase: Authentication → Providers → Email, then try again.'
        );
        return;
      }

      Alert.alert('Sign up failed', error.message || 'Unable to create your account.');
      return;
    }

    const sessionUser = data?.session?.user ?? data?.user;

    if (sessionUser) {
      await setAuth('email', {
        userId: sessionUser.id,
        email: sessionUser.email,
        name: name.trim() || sessionUser.user_metadata?.name || sessionUser.email,
      });
      setLoading(false);
      router.replace('/(tabs)');
      return;
    }

    setLoading(false);
    Alert.alert(
      'Check your email',
      'We sent you a confirmation link. Open it to finish creating your account.'
    );
    router.replace('/(auth)/login');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.duration(600).delay(100)} style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🚗</Text>
          </View>
          <Text style={styles.appTitle}>Create account</Text>
          <Text style={styles.subtitle}>Reserve parking in seconds with Vantage.</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(600).delay(250)} style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor="#64748b"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

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
              placeholder="Create a password"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.googleButton, pressed && styles.buttonPressed]}
            onPress={handleGoogleSignup}
            disabled={loading}
          >
            <Text style={styles.googleButtonText}>Sign up with Google</Text>
          </Pressable>

          <Pressable onPress={() => router.replace('/(auth)/login')} disabled={loading}>
            <Text style={styles.linkText}>Already have an account? Sign in</Text>
          </Pressable>

          {emailSignupDisabled && (
            <Pressable
              style={({ pressed }) => [styles.googleFallbackButton, pressed && styles.buttonPressed]}
              onPress={handleGoogleSignup}
              disabled={loading}
            >
              <Text style={styles.googleFallbackText}>Use Google instead</Text>
            </Pressable>
          )}
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
    width: 72,
    height: 72,
    backgroundColor: '#fff',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  logoIcon: {
    fontSize: 36,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  form: {
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
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    color: '#fff',
    fontSize: 16,
  },
  button: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  googleButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  linkText: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: 8,
    fontSize: 13,
  },
  googleFallbackButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    backgroundColor: '#111827',
  },
  googleFallbackText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
