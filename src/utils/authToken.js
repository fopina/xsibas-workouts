export const TOKEN_EXPIRES_AT_KEY = 'google_access_token_expires_at';

export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getJwtExpiresAt(token) {
  const payload = decodeJwtPayload(token);
  return Number.isFinite(payload?.exp) ? payload.exp * 1000 : null;
}

export function getTokenResponseExpiresAt(accessToken, tokenResponse, now = Date.now()) {
  const jwtExpiresAt = getJwtExpiresAt(accessToken);
  if (jwtExpiresAt) return jwtExpiresAt;

  const expiresIn = Number(tokenResponse?.expires_in);
  return Number.isFinite(expiresIn) && expiresIn > 0 ? now + expiresIn * 1000 : null;
}

export function formatSessionTimeLeft(expiresAt, now = Date.now()) {
  if (!expiresAt) return '';

  const remainingMs = expiresAt - now;
  if (remainingMs <= 0) return 'expired';

  const totalMinutes = Math.ceil(remainingMs / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m left`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m left` : `${hours}h left`;
}
