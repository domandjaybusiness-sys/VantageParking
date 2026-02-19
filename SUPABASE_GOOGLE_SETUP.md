# 🚀 Google Sign-In Setup Guide for Supabase

Your app is ready to use Google OAuth through Supabase! Follow these steps to complete the setup.

## ✅ What's Already Done

- ✅ Supabase client configured with AsyncStorage
- ✅ OAuth flow implemented in login screen
- ✅ Auth callback handler created
- ✅ Deep linking configured (scheme: `parkdemo`)
- ✅ User state management integrated

## 📋 Steps to Complete in Supabase Dashboard

### 1. Enable Google Provider in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com/project/jtynyaaqrcyhysaxgxbp)
2. Navigate to **Authentication** → **Providers**
3. Find **Google** in the list
4. Click to expand Google settings
5. Enable the Google provider

### 2. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**

#### For Web Application (Required for Supabase):
- **Application type**: Web application
- **Name**: Vantage Parking Web
- **Authorized JavaScript origins**:
  - `https://jtynyaaqrcyhysaxgxbp.supabase.co`
- **Authorized redirect URIs**:
  - `https://jtynyaaqrcyhysaxgxbp.supabase.co/auth/v1/callback`

#### For iOS (Optional - for native flow):
- **Application type**: iOS
- **Name**: Vantage Parking iOS
- **Bundle ID**: `com.vantageparking.app`

#### For Android (Optional - for native flow):
- **Application type**: Android
- **Name**: Vantage Parking Android
- **Package name**: `com.vantageparking.app`

### 3. Configure Supabase with Google Credentials

Back in Supabase Dashboard → Authentication → Providers → Google:

1. **Client ID**: Paste your Google Web Client ID
2. **Client Secret**: Paste your Google Web Client Secret
3. **Redirect URL** (should show): `https://jtynyaaqrcyhysaxgxbp.supabase.co/auth/v1/callback`
4. Click **Save**

### 4. Configure Redirect URLs in Supabase

1. In Supabase Dashboard → Authentication → **URL Configuration**
2. Add to **Redirect URLs**:
   ```
   parkdemo://auth/callback
   exp://localhost:8081/--/auth/callback
   ```
3. Set **Site URL** to: `parkdemo://`

### 5. Test the Integration

1. **Restart your Expo app**:
   ```bash
   # Stop the current server (Ctrl+C)
   npx expo start --clear
   ```

2. **Test Sign-In Flow**:
   - Tap "Sign in with Google"
   - Should open Google OAuth page in browser
   - Select your Google account
   - Grant permissions
   - Should redirect back to app
   - Should be logged in!

## 🔍 Troubleshooting

### "Invalid redirect URI" error
- Check that redirect URIs match exactly in Google Cloud Console
- Make sure Supabase callback URL is added to Google Console

### "Provider not enabled" error
- Verify Google provider is enabled in Supabase Dashboard
- Check that Client ID and Secret are saved

### App doesn't redirect back
- Verify scheme in app.json matches redirect URL
- Check that `parkdemo://auth/callback` is in Supabase Redirect URLs
- Restart Expo dev server

### Session not created
- Check Supabase logs in Dashboard → Logs
- Verify AsyncStorage permissions
- Check console for error messages

## 📱 Testing Checklist

- [ ] Google provider enabled in Supabase
- [ ] Google Client ID and Secret configured in Supabase
- [ ] Redirect URLs configured in Supabase
- [ ] Google Cloud Console redirect URIs match Supabase callback
- [ ] Expo dev server restarted with `--clear` flag
- [ ] Tested "Continue as Guest" (should work immediately)
- [ ] Tested "Sign in with Google" (should open browser)
- [ ] Successfully redirected back to app after OAuth
- [ ] User info saved and displayed in Profile tab

## 🎯 What Happens During Sign-In

1. User taps "Sign in with Google"
2. App calls Supabase `signInWithOAuth()`
3. Supabase returns Google OAuth URL
4. App opens URL in WebBrowser
5. User authenticates with Google
6. Google redirects to Supabase callback URL
7. Supabase processes OAuth token
8. Supabase redirects to `parkdemo://auth/callback`
9. App handles callback, gets session
10. User data saved to AsyncStorage
11. Navigate to main tabs

## 📊 Monitoring

Check Supabase Dashboard → Authentication → Users to see:
- New users created via Google OAuth
- User metadata (email, name, avatar)
- Last sign-in timestamps

## 🔐 Security Notes

- Client Secret is only used server-side by Supabase
- OAuth tokens are managed by Supabase
- Session tokens stored securely in AsyncStorage
- Sign out clears both local storage and Supabase session

## ✨ Optional Enhancements

### Get User Profile Photo
```typescript
const user = await getCurrentUser();
const avatarUrl = user?.user_metadata?.avatar_url;
```

### Customize OAuth Scopes
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    scopes: 'email profile openid',
    redirectTo: 'parkdemo://auth/callback',
  },
});
```

### Add Email Confirmation
In Supabase Dashboard → Authentication → Email Auth:
- Enable "Confirm email"
- Customize email templates

---

**Need Help?**
- Supabase Docs: https://supabase.com/docs/guides/auth/social-login/auth-google
- Google OAuth Docs: https://developers.google.com/identity/protocols/oauth2
