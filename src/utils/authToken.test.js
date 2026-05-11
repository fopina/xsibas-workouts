import { describe, it, expect } from 'vitest';
import {
  decodeJwtPayload,
  getJwtExpiresAt,
  getTokenResponseExpiresAt,
  formatSessionTimeLeft,
} from './authToken';

const base64Url = (value) => Buffer.from(JSON.stringify(value))
  .toString('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const makeJwt = (payload) => `${base64Url({ alg: 'none' })}.${base64Url(payload)}.`;

describe('authToken utilities', () => {
  it('decodes a JWT payload', () => {
    const token = makeJwt({ exp: 123, name: 'Filipe' });

    expect(decodeJwtPayload(token)).toEqual({ exp: 123, name: 'Filipe' });
  });

  it('returns null for opaque or malformed tokens', () => {
    expect(decodeJwtPayload('opaque-token')).toBeNull();
    expect(getJwtExpiresAt('opaque-token')).toBeNull();
  });

  it('reads expiry from JWT exp first', () => {
    const token = makeJwt({ exp: 200 });

    expect(getTokenResponseExpiresAt(token, { expires_in: 3600 }, 1000)).toBe(200000);
  });

  it('falls back to expires_in for non-JWT tokens', () => {
    expect(getTokenResponseExpiresAt('opaque-token', { expires_in: 3600 }, 1000)).toBe(3601000);
  });

  it('formats session time left', () => {
    expect(formatSessionTimeLeft(null, 0)).toBe('');
    expect(formatSessionTimeLeft(1000, 1000)).toBe('expired');
    expect(formatSessionTimeLeft(30 * 60 * 1000, 0)).toBe('30m left');
    expect(formatSessionTimeLeft(90 * 60 * 1000, 0)).toBe('1h 30m left');
    expect(formatSessionTimeLeft(2 * 60 * 60 * 1000, 0)).toBe('2h left');
  });
});
