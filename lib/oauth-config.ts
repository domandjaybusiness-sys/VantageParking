// OAuth Configuration
// This file contains redirect URIs for different environments

export const AUTH_CONFIG = {
  // App scheme for deep linking
  scheme: 'parkdemo',
  
  // OAuth redirect URIs
  redirectUri: {
    // For Expo Go development
    development: 'exp://localhost:8081/--/auth/callback',
    
    // For standalone builds
    production: 'parkdemo://auth/callback',
  },
  
  // Get the appropriate redirect URI based on environment
  getRedirectUri: (): string => {
    // In production builds, use the custom scheme
    // In development with Expo Go, use exp:// scheme
    if (__DEV__) {
      return 'parkdemo://auth/callback'; // Works with Expo Go
    }
    return 'parkdemo://auth/callback';
  },
};

// Supabase will handle the OAuth flow and redirect back to this URI
// Make sure this URI is added to:
// 1. Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
// 2. Google Cloud Console → OAuth Client → Authorized redirect URIs (Supabase callback)
