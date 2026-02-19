# ⚡ Quick Setup Checklist - Google Sign-In

## 🎯 You Need to Complete These Steps:

### Step 1: Google Cloud Console - OAuth Consent Screen (NEW - REQUIRED)
1. Go to: https://console.cloud.google.com/
2. Select your project
3. **APIs & Services** → **OAuth consent screen**
4. User Type: **External** → Create
5. Fill in:
   - App name: `Vantage Parking`
   - User support email: your email
   - Developer contact: your email
6. **Scopes**: Add `email`, `profile`, `openid`
7. **Test users**: Add your email (the one you'll sign in with) ⚠️ CRITICAL
8. Save and Continue

### Step 2: Google Cloud Console - OAuth Credentials (10 minutes)
1. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
2. Application type: **Web application**
3. **Authorized redirect URIs**: `https://jtynyaaqrcyhysaxgxbp.supabase.co/auth/v1/callback`
4. Copy the Client ID and Client Secret

### Step 3: Supabase Dashboard (5 minutes)
1. Go to: https://app.supabase.com/project/jtynyaaqrcyhysaxgxbp
2. **Authentication** → **Providers** → **Google**
3. Enable Google provider
4. Paste Google Client ID and Client Secret
5. In **URL Configuration**, add redirect URL: `parkdemo://auth/callback`
6. Click **Save**

## ✅ Then Test It!

```bash
# Restart your app
npx expo start --clear
```

Tap "Sign in with Google" - it should work! 🎉

---

**Getting "Access Blocked" error? See FIX_ACCESS_BLOCKED.md**
**Full details: SUPABASE_GOOGLE_SETUP.md**
