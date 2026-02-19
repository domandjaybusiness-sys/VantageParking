import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const AUTH_KEY = '@vantage_auth';

export type AuthMode = 'guest' | 'google' | 'apple' | null;

export interface AuthState {
  mode: AuthMode;
  timestamp?: number;
  userId?: string;
  email?: string;
  name?: string;
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

export async function setAuth(mode: AuthMode, userData?: Partial<AuthState>): Promise<void> {
  try {
    const state: AuthState = {
      mode,
      timestamp: Date.now(),
      ...userData,
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
    // Also sign out from Supabase
    await supabase.auth.signOut();
    console.log('✅ Auth state cleared');
  } catch (error) {
    console.error('Error clearing auth:', error);
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const auth = await getAuth();
  return auth !== null && auth.mode !== null;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
