# OAuth Authentication Setup

This app includes Google and Apple authentication. Follow these steps to enable them:

## Google Sign-In Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google Sign-In API**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Sign-In API"
   - Click "Enable"

3. **Create OAuth 2.0 Client IDs**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Create credentials for:
     - **iOS**: Select "iOS" application type
     - **Android**: Select "Android" application type
     - **Web**: For Expo Go testing

4. **Configure Redirect URIs**
   - For each client ID, add the redirect URI
   - Use `exp://` scheme for Expo Go development
   - Use `parkdemo://` for production builds

5. **Update the Code**
   - Open `app/(auth)/login.tsx`
   - Replace the placeholder client IDs:
     ```typescript
     const clientId = Platform.select({
       ios: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
       android: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
       web: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
     });
     ```

6. **Uncomment Production Code**
   - In `handleGoogle()` function, uncomment the WebBrowser.openAuthSessionAsync code
   - Remove the demo Alert.alert code

## Apple Sign-In Setup

1. **Apple Developer Account Required**
   - You need an active Apple Developer Program membership
   - Sign in to [Apple Developer](https://developer.apple.com/)

2. **Enable Sign in with Apple**
   - Go to "Certificates, Identifiers & Profiles"
   - Select your App ID
   - Enable "Sign In with Apple" capability

3. **Configure Your App**
   - The Apple Authentication plugin is already added to `app.json`
   - Build your app for iOS to enable the feature:
     ```bash
     eas build --platform ios
     ```

4. **Apple Sign-In Works Out of the Box**
   - The code in `app/(auth)/login.tsx` is production-ready
   - Apple's native button appears automatically on iOS 13+
   - On Android/Web, a fallback button is shown

## Testing

### Development Mode (Expo Go)
- Google: Shows informational dialog about setup
- Apple: Only works on physical iOS 13+ devices

### Production Mode (Standalone Build)
- Google: Opens actual Google OAuth flow
- Apple: Opens Apple's native authentication

## Security Notes

1. **Never commit OAuth credentials** to version control
2. Store client IDs in environment variables for production
3. Implement backend token verification
4. Use HTTPS for all production redirect URIs
5. Rotate credentials if they're ever exposed

## Current Status

✅ **Installed Packages:**
- expo-auth-session (Google OAuth)
- expo-apple-authentication (Apple Sign-In)
- expo-crypto (for PKCE)
- expo-web-browser (OAuth redirect handling)

✅ **UI Implemented:**
- Animated login screen
- Continue as Guest button
- Google Sign-In button
- Apple Sign-In button (native on iOS)

⚠️ **Production Setup Required:**
- Google OAuth Client IDs
- Backend token verification
- User profile storage

## Support

For issues with OAuth setup:
- Google: [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- Apple: [Sign in with Apple Documentation](https://developer.apple.com/sign-in-with-apple/)
- Expo: [Authentication Guide](https://docs.expo.dev/guides/authentication/)
