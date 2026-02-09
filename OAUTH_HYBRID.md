# Hybrid OAuth Strategy

This project uses a **hybrid OAuth approach** that automatically selects the best authentication method based on the environment:

## 🎯 Strategy Overview

| Environment | Method | Why |
|------------|--------|-----|
| **Production** | Google Identity Services (GIS) | ✅ Simpler, no redirect needed<br>✅ Better UX (popup)<br>✅ No proxy dependency |
| **Feature Branches** | OAuth Redirect Proxy | ✅ Works with dynamic URLs<br>✅ No Google Console changes needed<br>✅ Single redirect URI |
| **Localhost** | OAuth Redirect Proxy | ✅ Works with any port<br>✅ No Google Console changes needed |

## 🔄 How It Works

### Automatic Detection

The app automatically detects which mode to use:

```javascript
// Uses redirect proxy if:
const USE_REDIRECT_PROXY =
  import.meta.env.VITE_USE_OAUTH_PROXY === 'true' ||  // Explicit override
  window.location.hostname.includes('--') ||           // Cloudflare preview branches
  window.location.hostname.includes('localhost');      // Local development
```

### Production Mode (GIS)

**Domain:** `xsibas-workouts.pages.dev` (or your custom domain)

**Flow:**
1. User clicks "Log In"
2. Google popup appears (no redirect!)
3. User grants permission
4. Token received instantly
5. ✅ Done!

**Requirements:**
- GIS scripts loaded in `index.html` ✅
- `VITE_GOOGLE_CLIENT_ID` set ✅
- Google Console: Authorized JavaScript origins configured

### Feature Branch Mode (Redirect Proxy)

**Domain:** `feature-name--xsibas-workouts.pages.dev` (Cloudflare preview format)

**Flow:**
1. User clicks "Log In"
2. Redirected to Google
3. Redirected to proxy: `xsibas-workouts.pages.dev/oauth/callback`
4. Proxy forwards back to feature branch with code
5. App exchanges code for token
6. ✅ Done!

**Requirements:**
- Proxy function deployed in `/functions/oauth/callback.js` ✅
- `VITE_OAUTH_REDIRECT_URI` set ✅
- Google Console: Redirect URI configured

## 📋 Setup Instructions

### 1. Configure Google Console

#### For Production (GIS):
- **Authorized JavaScript origins:**
  - `https://xsibas-workouts.pages.dev`
  - Any custom domains you use

#### For Feature Branches (Redirect Proxy):
- **Authorized redirect URIs:**
  - `https://xsibas-workouts.pages.dev/oauth/callback`

That's it! Just these two sections.

### 2. Environment Variables

**`.env` (already configured):**
```bash
VITE_GOOGLE_CLIENT_ID=1038539316226-851c85pjeoovi1q0uvu1qvcls5ef2v9c.apps.googleusercontent.com
VITE_OAUTH_REDIRECT_URI=https://xsibas-workouts.pages.dev/oauth/callback
```

**Optional override:**
```bash
# Force redirect proxy mode even on production
VITE_USE_OAUTH_PROXY=true
```

### 3. Update Allowed Domains in Proxy

Edit `/functions/oauth/callback.js`:

```javascript
const allowedDomains = [
  'localhost',
  '127.0.0.1',
  'xsibas-workouts.pages.dev',  // Your Cloudflare Pages domain
];
```

The proxy validates that redirects only go to allowed domains. Cloudflare Pages preview branches (e.g., `feature-x--xsibas-workouts.pages.dev`) will match `xsibas-workouts.pages.dev` due to subdomain matching.

### 4. Deploy

```bash
# Push to your main branch
git add .
git commit -m "Add hybrid OAuth strategy"
git push

# Cloudflare Pages will automatically deploy:
# - Main branch → Production (uses GIS)
# - Feature branches → Preview (uses redirect proxy)
```

## 🧪 Testing

### Test Production Mode (GIS)

1. Visit your production URL: `https://xsibas-workouts.pages.dev`
2. Open browser console
3. Click "Log In"
4. You should see: `"Using OAuth mode: GIS (production)"`
5. A Google popup should appear (no redirect!)

### Test Feature Branch Mode (Redirect Proxy)

1. Create a feature branch and push:
   ```bash
   git checkout -b test-oauth
   git push origin test-oauth
   ```
2. Wait for Cloudflare to deploy preview
3. Visit preview URL: `https://test-oauth--xsibas-workouts.pages.dev`
4. Open browser console
5. Click "Log In"
6. You should see: `"Using OAuth mode: Redirect Proxy (feature branch)"`
7. Full page redirect to Google → proxy → back to your branch

### Test Local Development

```bash
npm run dev:lan  # HTTPS required for OAuth
```

1. Visit `https://localhost:5173`
2. Click "Log In"
3. Should use redirect proxy mode
4. After redirecting through Google, you'll land on `https://localhost:5173?code=...`
5. Token exchange happens automatically

## 🔍 Debugging

### Check Which Mode Is Active

Open browser console and look for:
```
Using OAuth mode: GIS (production)
```
or
```
Using OAuth mode: Redirect Proxy (feature branch)
```

### Common Issues

#### Production mode not working
- **Symptom:** "Token client not initialized" error
- **Fix:** Ensure GIS scripts are loaded in `index.html`
- **Check:** Look for `https://accounts.google.com/gsi/client` in Network tab

#### Redirect proxy mode not working
- **Symptom:** "Unauthorized Domain" error after OAuth
- **Fix:** Add your domain to `allowedDomains` in `/functions/oauth/callback.js`

#### Wrong mode is being used
- **Symptom:** Production using redirect proxy when it should use GIS
- **Debug:** Check `window.location.hostname` in console
  - Should NOT contain `--` for production
  - Should NOT be `localhost`
- **Fix:** Set `VITE_USE_OAUTH_PROXY=false` explicitly

## 🎛️ Manual Mode Override

If you want to force a specific mode:

### Force Redirect Proxy (even on production):
```bash
# .env
VITE_USE_OAUTH_PROXY=true
```

### Force GIS (even on feature branches):
```bash
# .env
VITE_USE_OAUTH_PROXY=false
```

Then update the detection logic in `src/components/auth.jsx`:
```javascript
const USE_REDIRECT_PROXY = import.meta.env.VITE_USE_OAUTH_PROXY === 'true';
```

## 🚀 Benefits of This Approach

✅ **Best UX for production:** No page redirects, instant popup
✅ **No maintenance for feature branches:** Just push and it works
✅ **Single Google OAuth configuration:** No need to add every branch URL
✅ **Secure:** Proxy validates allowed domains
✅ **Flexible:** Can override behavior with env vars

## 📚 Additional Documentation

- **Full setup guide:** See `OAUTH_SETUP.md`
- **Quick deployment:** See `DEPLOY_OAUTH.md`
- **Architecture details:** See `OAUTH_SETUP.md` > "How It Works"

## 🤔 Why Not Just Use Redirect Proxy Everywhere?

Good question! Here's why we use GIS for production:

1. **Better UX:** No page reload, instant popup (feels more native)
2. **Faster:** No extra redirect hop through the proxy
3. **More reliable:** No dependency on proxy function being available
4. **Industry standard:** Google recommends GIS for single-domain apps

But for feature branches, the redirect proxy is essential because:
1. Google doesn't support wildcard redirect URIs
2. Feature branch URLs change with every branch
3. Managing hundreds of redirect URIs in Google Console would be impractical

The hybrid approach gives you the best of both worlds! 🎉
