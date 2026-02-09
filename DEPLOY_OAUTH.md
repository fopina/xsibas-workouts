# Quick OAuth Deployment Guide

**Note:** This project uses a **hybrid OAuth strategy**. Production uses Google Identity Services (GIS), while feature branches use the redirect proxy. See `OAUTH_HYBRID.md` for details.

---

# OAuth Proxy Setup (for Feature Branches)

## Step 1: Update Allowed Domains

Edit `functions/oauth/callback.js` and update the `allowedDomains` array:

```javascript
const allowedDomains = [
  'localhost',
  '127.0.0.1',
  'xsibas-workouts.pages.dev',  // Your Cloudflare Pages domain
  // Add any custom domains you have
];
```

## Step 2: Deploy to Cloudflare Pages

Since your app is likely already on Cloudflare Pages, the `/functions` directory will be automatically deployed! No extra work needed.

**Your OAuth callback URL will be:**
```
https://xsibas-workouts.pages.dev/oauth/callback
```

*(Replace `xsibas-workouts` with your actual Cloudflare Pages project name)*

## Step 3: Configure Google OAuth Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Click on your OAuth 2.0 Client ID
3. Configure both sections:

   **Authorized JavaScript origins** (for production GIS):
   ```
   https://xsibas-workouts.pages.dev
   ```

   **Authorized redirect URIs** (for feature branches):
   ```
   https://xsibas-workouts.pages.dev/oauth/callback
   ```

4. Click **Save**

**That's it!** Production will use GIS (no redirect), while feature branches will use the redirect proxy.

## Step 4: Update Environment Variable

Already done in `.env`:
```bash
VITE_OAUTH_REDIRECT_URI=https://xsibas-workouts.pages.dev/oauth/callback
```

Make sure this is also set in your Cloudflare Pages environment variables:
1. Go to your Cloudflare Pages project
2. **Settings** > **Environment Variables**
3. Add:
   - **Variable name:** `VITE_OAUTH_REDIRECT_URI`
   - **Value:** `https://xsibas-workouts.pages.dev/oauth/callback`

## Step 5: Test It!

### Local Testing (HTTPS required):
```bash
npm run dev:lan
```
Then visit `https://localhost:5173` and try logging in.

### Production Testing:
1. Deploy your changes to Cloudflare Pages
2. Visit your app
3. Click "Log In"
4. You should be redirected to Google, then back to your app

## How It Works for Feature Branches

When you create a feature branch (e.g., `feature-new-exercise`):

1. Cloudflare Pages automatically deploys it: `https://feature-new-exercise.xsibas-workouts.pages.dev`
2. The OAuth flow works immediately (no configuration needed!)
3. When you click "Log In":
   - Google redirects to: `https://xsibas-workouts.pages.dev/oauth/callback`
   - The proxy reads the `state` parameter and sees you came from the feature branch
   - It redirects you back to: `https://feature-new-exercise.xsibas-workouts.pages.dev?code=...`
   - Your app exchanges the code for a token

## Troubleshooting

### "redirect_uri_mismatch" error
- Check that the redirect URI in Google Console exactly matches your proxy URL
- No trailing slashes: `https://xsibas-workouts.pages.dev/oauth/callback` (correct)
- With trailing slash: `https://xsibas-workouts.pages.dev/oauth/callback/` (wrong)

### "Unauthorized Domain" error
- Add the domain to `allowedDomains` in `functions/oauth/callback.js`
- Redeploy your Cloudflare Pages project

### Token exchange fails with CORS error
- Make sure `VITE_OAUTH_REDIRECT_URI` is set correctly
- Check browser console for detailed error messages

### Local development not working
- You MUST use HTTPS: `npm run dev:lan` (not `npm run dev`)
- Accept the self-signed certificate warning in your browser
- Make sure `localhost` is in the `allowedDomains` array

## Security Notes

✅ Only allowed domains can receive OAuth callbacks
✅ The `state` parameter prevents CSRF attacks
✅ All OAuth happens over HTTPS
✅ Access tokens are never logged or stored on the proxy

## Next Steps

After deployment works:
1. ✅ Test login flow on production
2. ✅ Test login flow on a feature branch
3. ✅ Test logout
4. ✅ Test token persistence (refresh page after login)
5. Remove old Google OAuth setup if you had one

## Questions?

See the full documentation in `OAUTH_SETUP.md` for architecture details and advanced configuration.
