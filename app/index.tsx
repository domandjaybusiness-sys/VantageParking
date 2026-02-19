import { isAuthenticated } from '@/lib/auth';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function Index() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    async function check() {
      console.log('🔐 Checking authentication...');
      const result = await isAuthenticated();
      console.log('🔐 Auth result:', result);
      setAuthed(result);
      setAuthChecked(true);
    }
    check();
  }, []);

  if (!authChecked) {
    // Show loading while checking auth
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  console.log('🔐 Redirecting to:', authed ? '/(tabs)' : '/(auth)/login');

  if (authed) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
});
