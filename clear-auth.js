// Quick script to clear AsyncStorage auth state
// Run this to reset the app to show login screen

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

async function clearAuth() {
  try {
    await AsyncStorage.removeItem('@vantage_auth');
    console.log('✅ Auth state cleared! The app will now show the login screen.');
  } catch (error) {
    console.error('Error clearing auth:', error);
  }
}

clearAuth();
