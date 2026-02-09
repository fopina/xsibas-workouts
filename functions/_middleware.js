/**
 * Cloudflare Pages Functions Middleware
 *
 * Add CORS headers to allow OAuth callback to work from any origin
 */

export async function onRequest(context) {
  const response = await context.next();

  // Add CORS headers for OAuth endpoints
  if (context.request.url.includes('/oauth/')) {
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  return response;
}
