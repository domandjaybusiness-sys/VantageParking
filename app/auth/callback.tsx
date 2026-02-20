import { setAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      console.log('🔄 Processing auth callback...');
      
      try {
        // Get the current session
        const { data: sessionData, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Callback session error:', error);
          router.replace('/(auth)/login');
          return;
        }

        if (sessionData?.session) {
          const user = sessionData.session.user;
          console.log('✅ Callback: User authenticated:', user.email);
          
          // Determine provider from metadata
          const provider = user.app_metadata?.provider || 'google';
          
          // Save auth state
          await setAuth(provider as any, {
            userId: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email,
          });
          
          // Navigate to main app
          router.replace('/(tabs)');
        } else {
          console.log('Callback: No session found');
          router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('Callback error:', error);
        router.replace('/(auth)/login');
      }
    }

    handleCallback();
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366f1" />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  text: {
    marginTop: 16,
    color: '#fff',
    fontSize: 16,
  },
});
