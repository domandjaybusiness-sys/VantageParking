import { setAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGuest = async () => {
    setLoading(true);
    await setAuth('guest');
    setLoading(false);
    router.replace('/(tabs)');
  };

  const handleGoogle = async () => {
    setLoading(true);
    // Placeholder: real OAuth will go here
    await new Promise((resolve) => setTimeout(resolve, 800));
    await setAuth('google');
    setLoading(false);
    router.replace('/(tabs)');
  };

  const handleApple = async () => {
    setLoading(true);
    // Placeholder: real OAuth will go here
    await new Promise((resolve) => setTimeout(resolve, 800));
    await setAuth('apple');
    setLoading(false);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* App Logo/Title */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>Vantage Parking</Text>
          <Text style={styles.subtitle}>Find & reserve parking in seconds</Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.button, styles.guestButton]}
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
            style={[styles.button, styles.googleButton]}
            onPress={handleGoogle}
            disabled={loading}
          >
            <Text style={styles.socialButtonText}>🔵 Sign in with Google</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.appleButton]}
            onPress={handleApple}
            disabled={loading}
          >
            <Text style={styles.socialButtonText}>🍎 Sign in with Apple</Text>
          </Pressable>

          <Text style={styles.disclaimer}>
            We'll add real sign-in next.
          </Text>
        </View>
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
  guestButton: {
    backgroundColor: '#10b981',
  },
  googleButton: {
    backgroundColor: '#fff',
  },
  appleButton: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#333',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  socialButtonText: {
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
