import { google } from 'googleapis';

export const GOOGLE_PICKER_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export function normalizePrivateKey(input) {
  if (!input) return input;

  const maybePem = input.includes('BEGIN PRIVATE KEY') ? input : null;
  if (maybePem) {
    return maybePem.replaceAll('\\n', '\n');
  }

  try {
    const decoded = Buffer.from(input, 'base64').toString('utf8');
    if (decoded.includes('BEGIN PRIVATE KEY')) {
      return decoded.replaceAll('\\n', '\n');
    }
  } catch {
    // Fall through to raw input
  }

  return input.replaceAll('\\n', '\n');
}

export async function mintServiceAccountAccessToken({
  serviceAccountEmail,
  privateKeyRaw,
  scopes = GOOGLE_PICKER_SCOPES,
}) {
  if (!serviceAccountEmail || !privateKeyRaw) {
    throw new Error('Missing service account email/private key');
  }

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: normalizePrivateKey(privateKeyRaw),
    scopes,
  });

  const tokenResponse = await auth.authorize();
  const accessToken = tokenResponse.access_token;
  if (!accessToken) {
    throw new Error('Service account login did not return an access token');
  }

  return { accessToken, tokenResponse };
}
