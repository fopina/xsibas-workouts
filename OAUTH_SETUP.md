# OAuth Setup Guide

This project uses a **Cloudflare Pages Function as an OAuth redirect proxy** to support feature branch development with Google OAuth.

## Architecture

```
User on feature-branch.pages.dev
    ↓ (clicks "Log In")
Google OAuth Authorization
    ↓ (redirects with code)
Cloudflare Pages Function Proxy
  (oauth-proxy.pages.dev/oauth/callback)
    ↓ (forwards code + returns user)
Original feature branch URL
    ↓ (exchanges code for token)
Google OAuth Token Endpoint
```

## Why This Approach?

Google OAuth doesn't support wildcard redirect URIs. To support:
- Local development (`localhost:3000`, `localhost:5173`, etc.)
- Feature branches (`feature-xyz.pages.dev`)
- Production (`workouts.yourdomain.com`)

We use a **single registered redirect URI** that acts as a proxy and forwards OAuth responses back to the originating URL.

## Setup Instructions

### 1. Deploy the OAuth Proxy to Cloudflare Pages

The OAuth proxy is located in `/functions/oauth/callback.js`.

#### Option A: Deploy as a separate Cloudflare Pages project (Recommended)

```bash
# Create a new directory for the proxy
mkdir oauth-proxy
cd oauth-proxy

# Copy the functions directory
cp -r ../functions .

# Create a minimal index.html (required by Cloudflare Pages)
echo '<!DOCTYPE html><html><body><h1>OAuth Proxy</h1></body></html>' > index.html

# Deploy to Cloudflare Pages
# Method 1: Connect to GitHub and auto-deploy
# Method 2: Use Wrangler CLI
npx wrangler pages deploy . --project-name=oauth-proxy
```

Your proxy will be available at: `https://oauth-proxy.pages.dev/oauth/callback`

#### Option B: Deploy alongside your main app

If you deploy your main app to Cloudflare Pages, the proxy function is already included and will be available at:
`https://your-app.pages.dev/oauth/callback`

### 2. Configure Allowed Domains

Edit `/functions/oauth/callback.js` and update the `allowedDomains` array:

```javascript
const allowedDomains = [
  'localhost',
  '127.0.0.1',
  'workouts.yourdomain.com',        // Your production domain
  'your-app.pages.dev',             // Your Cloudflare Pages domain
  // Add any other allowed domains
];
```

This security measure ensures the proxy only redirects to your trusted domains.

### 3. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials**
3. Select your OAuth 2.0 Client ID (or create a new one)
4. Under **Authorized redirect URIs**, add:
   ```
   https://oauth-proxy.pages.dev/oauth/callback
   ```
   (Replace with your actual proxy URL)

5. **IMPORTANT**: You only need ONE redirect URI in Google Console now!

### 4. Set Environment Variables

Create/update `.env` (for local development):

```bash
# Your Google OAuth Client ID
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# The OAuth redirect proxy URL
VITE_OAUTH_REDIRECT_URI=https://oauth-proxy.pages.dev/oauth/callback
```

For production/preview deployments, set these in your deployment platform:
- Cloudflare Pages: **Settings** > **Environment Variables**
- Vercel: **Settings** > **Environment Variables**
- Netlify: **Site Settings** > **Environment Variables**

### 5. Test the Flow

#### Local Development:
```bash
npm run dev
```
1. Click "Log In"
2. You'll be redirected to Google
3. After authorization, you'll go through the proxy
4. You'll return to `localhost:XXXX` with the auth code
5. The app exchanges the code for a token

#### Feature Branches:
When you deploy a feature branch to Cloudflare Pages (e.g., `feature-xyz.pages.dev`):
1. The same OAuth flow works automatically
2. The proxy remembers where you came from (via `state` parameter)
3. You're redirected back to your feature branch after auth

## How It Works

### 1. Login Initiated
When the user clicks "Log In", the app:
```javascript
// Build OAuth URL with state parameter
const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
  'client_id=YOUR_CLIENT_ID' +
  '&redirect_uri=https://oauth-proxy.pages.dev/oauth/callback' +
  '&response_type=code' +
  '&scope=...' +
  '&state=' + encodeURIComponent(window.location.origin);

// Redirect to Google
window.location.href = authUrl;
```

The `state` parameter contains the current URL (e.g., `https://feature-branch.pages.dev`).

### 2. Google Callback
Google redirects to:
```
https://oauth-proxy.pages.dev/oauth/callback?code=XXX&state=https://feature-branch.pages.dev
```

### 3. Proxy Forwards
The Cloudflare Function:
1. Validates the `state` parameter is an allowed domain
2. Forwards the user back:
```
https://feature-branch.pages.dev?code=XXX
```

### 4. Token Exchange
The app detects the `code` parameter and exchanges it for an access token:
```javascript
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: {
    code,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  }
});
```

## Security Considerations

1. **Domain Allowlist**: The proxy validates redirect domains against an allowlist
2. **State Parameter**: Used to prevent CSRF attacks and ensure the user returns to the correct URL
3. **HTTPS Only**: OAuth requires HTTPS (use `npm run dev:lan` for local HTTPS)
4. **Client Secret**: Not exposed to the client (standard OAuth2 PKCE flow would be even better)

## Troubleshooting

### "Unauthorized Domain" Error
- Add your domain to `allowedDomains` in `/functions/oauth/callback.js`
- Redeploy the Cloudflare Function

### "Redirect URI Mismatch" Error
- Ensure `VITE_OAUTH_REDIRECT_URI` matches the URI registered in Google Console
- Check for trailing slashes (be consistent)

### Token Exchange Fails
- Verify `VITE_GOOGLE_CLIENT_ID` is correct
- Check browser console for detailed error messages
- Ensure the redirect URI in token exchange matches Google Console

### Local Development Not Working
- Use HTTPS: `npm run dev:lan` (required by Google OAuth)
- Check that `localhost` is in `allowedDomains`

## Alternative Approaches Considered

1. **Multiple OAuth Clients**: Create separate credentials for each environment
   - ❌ Management overhead, multiple secrets to maintain

2. **Wildcard Domains**: Use `*.pages.dev` as redirect URI
   - ❌ Google doesn't support wildcards

3. **Token-Based Flow (GIS)**: Continue using `initTokenClient`
   - ❌ Less secure, limited refresh token support

4. **OAuth Proxy** (chosen approach)
   - ✅ Single redirect URI for all environments
   - ✅ Works with any domain
   - ✅ Standard OAuth2 flow
   - ✅ Easy to maintain

## Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
