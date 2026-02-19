# 🔴 Fix "Access Blocked: Invalid App Request" Error

## What This Error Means

Google is blocking the OAuth request because your OAuth Consent Screen isn't configured or your app isn't verified.

## ⚡ Quick Fix (5 minutes)

### Step 1: Configure OAuth Consent Screen

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **OAuth consent screen**

### Step 2: Fill Out Required Information

#### User Type:
- Select **External** (anyone with a Google account)
- Click **Create**

#### App Information:
- **App name**: `Vantage Parking`
- **User support email**: Your email
- **App logo**: (optional - skip for now)
- **Application home page**: `https://vantageparking.com` (or any URL)
- **Authorized domains**: Leave blank for testing
- **Developer contact**: Your email

Click **Save and Continue**

#### Scopes:
- Click **Add or Remove Scopes**
- Select these scopes:
  - `.../auth/userinfo.email`
  - `.../auth/userinfo.profile`
  - `openid`
- Click **Update**
- Click **Save and Continue**

#### Test Users (IMPORTANT):
- Click **+ Add Users**
- Add your Google email address (the one you'll test with)
- Click **Add**
- Click **Save and Continue**

### Step 3: Set Publishing Status

- Review summary
- Your app will be in **Testing** mode
- This allows you and your test users to sign in
- Click **Back to Dashboard**

### Step 4: Verify OAuth Client Settings

1. Go to **Credentials** 
2. Click on your OAuth 2.0 Client ID
3. Verify **Authorized redirect URIs** includes:
   ```
   https://jtynyaaqrcyhysaxgxbp.supabase.co/auth/v1/callback
   ```
4. Click **Save**

### Step 5: Test Again

1. **Restart your Expo app**:
   ```bash
   npx expo start --clear
   ```

2. Tap "Sign in with Google"
3. You should now see the Google account picker!
4. Select your account (must be one you added as test user)
5. Grant permissions
6. Should redirect back and sign you in ✅

## 🔍 Common Issues & Solutions

### Still seeing "Access Blocked"?

**Check Test Users:**
- Make sure the email you're signing in with is added to Test Users
- In OAuth consent screen → Test users → + Add Users

**Check App Status:**
- OAuth consent screen should show "Testing" status
- If it says "Needs verification", that's OK for testing

**Check Scopes:**
- Make sure you added the required scopes (email, profile, openid)

### "Redirect URI mismatch" error?

1. In Google Cloud Console → Credentials → Your OAuth Client
2. Add this exact URI to "Authorized redirect URIs":
   ```
   https://jtynyaaqrcyhysaxgxbp.supabase.co/auth/v1/callback
   ```
3. Make sure there are NO extra spaces or characters
4. Click Save

### Still not working?

**Clear browser cache:**
- The OAuth error might be cached
- Open the browser directly and clear cookies for accounts.google.com

**Double-check Supabase:**
1. Go to Supabase Dashboard → Authentication → Providers → Google
2. Make sure:
   - Google is enabled (toggle is green)
   - Client ID is filled in
   - Client Secret is filled in
   - No extra spaces in either field
3. Save

**Check the redirect URLs in Supabase:**
1. Supabase Dashboard → Authentication → URL Configuration
2. Add to "Redirect URLs":
   ```
   parkdemo://auth/callback
   exp://localhost:8081/--/auth/callback
   ```

## 📊 Verification Checklist

Before testing, verify:

- [ ] OAuth Consent Screen created
- [ ] App name set to "Vantage Parking"
- [ ] User support email filled in
- [ ] Scopes added (email, profile, openid)
- [ ] Your email added as Test User
- [ ] OAuth Client ID created (Web application type)
- [ ] Supabase callback URL in authorized redirect URIs
- [ ] Client ID and Secret copied to Supabase
- [ ] Google provider enabled in Supabase
- [ ] Redirect URLs added in Supabase URL Configuration
- [ ] Expo dev server restarted

## 🎯 Testing Mode vs Production

### Testing Mode (What you're using now):
- ✅ Free
- ✅ Works immediately
- ✅ Up to 100 test users
- ⚠️ Shows "unverified app" warning
- ⚠️ Only test users can sign in

### Production Mode (For public release):
- Requires app verification from Google
- Costs nothing but takes 4-6 weeks review
- Anyone can sign in
- No "unverified app" warning
- Need to submit for review when ready to publish

## 💡 For Now: Use Testing Mode

Testing mode is perfect for development and even beta testing! You can:
- Add up to 100 test users
- Test the full OAuth flow
- Use it for months without issues

When you're ready to launch publicly, you can submit for verification.

## 🆘 Still Having Issues?

If you've followed all steps and it's still not working:

1. **Check the Expo console** for error messages
2. **Check Supabase logs**: Dashboard → Logs → Auth logs
3. **Try the Guest Mode** to verify the rest of the app works
4. **Double-check every setting** matches the screenshots/instructions

## ✅ Success Indicators

You'll know it's working when:
1. Clicking "Sign in with Google" opens a browser
2. You see Google's account picker (blue/white screen)
3. You can select your account
4. You see permission request page
5. After granting, browser closes
6. App shows main tabs
7. Profile shows your Google email

---

**Most Common Fix:** Add your email to Test Users in OAuth Consent Screen! 🎯
