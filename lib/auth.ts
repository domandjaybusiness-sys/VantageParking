import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY = '@vantage_auth';

export type AuthMode = 'guest' | 'google' | 'apple' | null;

export interface AuthState {
  mode: AuthMode;
  timestamp?: number;
}

export async function getAuth(): Promise<AuthState | null> {
  try {
    const value = await AsyncStorage.getItem(AUTH_KEY);
    console.log('📱 AsyncStorage raw value:', value);
    if (value) {
      const parsed = JSON.parse(value);
      console.log('📱 Parsed auth state:', parsed);
      return parsed;
    }
    console.log('📱 No auth state found');
    return null;
  } catch (error) {
    console.error('Error reading auth:', error);
    return null;
  }
}

export async function setAuth(mode: AuthMode): Promise<void> {
  try {
    const state: AuthState = {
      mode,
      timestamp: Date.now(),
    };
    console.log('📱 Setting auth state:', state);
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(state));
    console.log('✅ Auth state saved');
  } catch (error) {
    console.error('Error saving auth:', error);
  }
}

export async function clearAuth(): Promise<void> {
  try {
    console.log('📱 Clearing auth state...');
    await AsyncStorage.removeItem(AUTH_KEY);
    console.log('✅ Auth state cleared');
  } catch (error) {
    console.error('Error clearing auth:', error);
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const auth = await getAuth();
  return auth !== null && auth.mode !== null;
}
