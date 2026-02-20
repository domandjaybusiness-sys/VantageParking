import { setAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
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

export default function EmailLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    setNeedsConfirmation(false);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      const message = error.message || 'Unable to sign in.';
      if (message.toLowerCase().includes('email not confirmed')) {
        setNeedsConfirmation(true);
        setLoading(false);
        Alert.alert('Confirm your email', 'Please confirm your email to finish signing in.');
        return;
      }
      setLoading(false);
      Alert.alert('Login failed', message);
      return;
    }

    const sessionUser = data?.user ?? data?.session?.user;

    if (sessionUser) {
      await setAuth('email', {
        userId: sessionUser.id,
        email: sessionUser.email,
        name: sessionUser.user_metadata?.name || sessionUser.user_metadata?.full_name || sessionUser.email,
      });
      setLoading(false);
      router.replace('/(tabs)');
      return;
    }

    setLoading(false);
    Alert.alert('Login failed', 'No active session found.');
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type your email first so we can resend the confirmation link.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    });
    setLoading(false);

    if (error) {
      Alert.alert('Resend failed', error.message || 'Unable to resend confirmation email.');
      return;
    }

    Alert.alert('Check your email', 'We sent you a new confirmation link.');
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type your email first so we can send a reset link.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'parkdemo://auth/callback',
    });

    setLoading(false);

    if (error) {
      Alert.alert('Reset failed', error.message || 'Unable to send reset email.');
      return;
    }

    Alert.alert('Check your email', 'We sent you a password reset link.');
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
          <Text style={styles.appTitle}>Log in</Text>
          <Text style={styles.subtitle}>Welcome back to Vantage.</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(600).delay(250)} style={styles.form}>
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
              placeholder="Your password"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={styles.buttonText}>Log in</Text>
            )}
          </Pressable>

          {needsConfirmation ? (
            <Pressable onPress={handleResendConfirmation} disabled={loading}>
              <Text style={styles.secondaryLink}>Resend confirmation email</Text>
            </Pressable>
          ) : null}

          <Pressable onPress={handleForgotPassword} disabled={loading}>
            <Text style={styles.secondaryLink}>Forgot password?</Text>
          </Pressable>

          <Pressable onPress={() => router.replace('/(auth)/signup')} disabled={loading}>
            <Text style={styles.linkText}>Need an account? Create one</Text>
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
  linkText: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: 8,
    fontSize: 13,
  },
  secondaryLink: {
    textAlign: 'center',
    color: '#38bdf8',
    marginTop: 4,
    fontSize: 13,
  },
});
