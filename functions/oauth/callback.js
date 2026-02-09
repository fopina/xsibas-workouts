/**
 * Cloudflare Pages Function - OAuth Redirect Proxy
 *
 * This function acts as a unified OAuth callback endpoint that accepts
 * Google OAuth redirects and forwards them to the appropriate feature branch URL.
 *
 * Flow:
 * 1. User initiates OAuth from any branch (e.g., feature-branch.example.com)
 * 2. Google redirects to this proxy: https://oauth.example.com/oauth/callback
 * 3. This function reads the 'state' parameter containing the original URL
 * 4. Forwards the user back to their original branch with OAuth tokens
 */

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Extract OAuth parameters from the callback
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // If there's an OAuth error, handle it
  if (error) {
    console.error('OAuth error:', error, errorDescription);

    // Try to redirect to state URL with error, or show error page
    if (state) {
      try {
        const redirectUrl = new URL(decodeURIComponent(state));
        redirectUrl.searchParams.set('oauth_error', error);
        if (errorDescription) {
          redirectUrl.searchParams.set('oauth_error_description', errorDescription);
        }
        return Response.redirect(redirectUrl.toString(), 302);
      } catch (e) {
        // Invalid state URL, show error page
      }
    }

    return new Response(
      `<html>
        <head><title>OAuth Error</title></head>
        <body>
          <h1>Authentication Error</h1>
          <p><strong>Error:</strong> ${error}</p>
          ${errorDescription ? `<p><strong>Description:</strong> ${errorDescription}</p>` : ''}
          <p><a href="/">Return to home</a></p>
        </body>
      </html>`,
      {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }

  // State parameter is required - it contains the redirect URL
  if (!state) {
    return new Response(
      `<html>
        <head><title>Missing State Parameter</title></head>
        <body>
          <h1>Invalid OAuth Request</h1>
          <p>Missing state parameter. This endpoint requires a valid state parameter containing the redirect URL.</p>
        </body>
      </html>`,
      {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }

  try {
    // Decode the state parameter to get the original URL
    const redirectUrl = new URL(decodeURIComponent(state));

    // Validate the redirect URL is from an allowed domain
    const allowedDomains = [
      'localhost',
      '127.0.0.1',
      // Add your production domain
      // 'workouts.yourdomain.com',
      // Add your preview domain pattern
      // 'xsibas-workouts.pages.dev',
      // Add any other allowed domains
    ];

    // Extract hostname for validation
    const redirectHostname = redirectUrl.hostname;

    // Check if the redirect hostname is allowed
    const isAllowed = allowedDomains.some(domain => {
      // Exact match
      if (redirectHostname === domain) return true;
      // Subdomain match (e.g., *.pages.dev)
      if (redirectHostname.endsWith('.' + domain)) return true;
      // For localhost with port
      if (domain === 'localhost' && redirectHostname.startsWith('localhost')) return true;
      return false;
    });

    if (!isAllowed) {
      console.error('Unauthorized redirect domain:', redirectHostname);
      return new Response(
        `<html>
          <head><title>Unauthorized Domain</title></head>
          <body>
            <h1>Unauthorized Redirect</h1>
            <p>The redirect domain <code>${redirectHostname}</code> is not authorized.</p>
            <p>Please contact support if you believe this is an error.</p>
          </body>
        </html>`,
        {
          status: 403,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    // Forward OAuth parameters to the original URL
    if (code) {
      redirectUrl.searchParams.set('code', code);
    }

    // Forward any additional parameters (like scope, etc.)
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== 'state' && key !== 'code') {
        redirectUrl.searchParams.set(key, value);
      }
    }

    console.log('Redirecting to:', redirectUrl.toString());

    // Redirect back to the original URL with OAuth parameters
    return Response.redirect(redirectUrl.toString(), 302);

  } catch (e) {
    console.error('Error processing redirect:', e);
    return new Response(
      `<html>
        <head><title>Invalid State Parameter</title></head>
        <body>
          <h1>Invalid OAuth State</h1>
          <p>The state parameter could not be decoded or is not a valid URL.</p>
          <p><strong>Error:</strong> ${e.message}</p>
        </body>
      </html>`,
      {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}
