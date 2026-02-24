#!/usr/bin/env node

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { google } from 'googleapis';
import { mintServiceAccountAccessToken } from './google-auth-utils.mjs';

const DEFAULT_PORT = 5173;
const LOGIN_PATH = '/__google_cli_login__';
const TOKEN_PATH = `${LOGIN_PATH}/token`;
const DONE_PATH = `${LOGIN_PATH}/done`;
const PICKER_PATH = '/__google_cli_picker__';
const PICKER_SELECT_PATH = `${PICKER_PATH}/selected`;
const PICKER_DONE_PATH = `${PICKER_PATH}/done`;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const PICKER_TIMEOUT_MS = 5 * 60 * 1000;
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.profile',
];
const PICKER_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
];

function printHelp() {
  console.log(`Google Sheets dev CLI (ephemeral token)

Usage:
  node scripts/google-dev-cli.mjs login [--port 5173]
  node scripts/google-dev-cli.mjs login-sa
  node scripts/google-dev-cli.mjs picker [--port 5173]
  node scripts/google-dev-cli.mjs get <SHEET_ID> [--token <ACCESS_TOKEN>]
  node scripts/google-dev-cli.mjs logout [--token <ACCESS_TOKEN>]

Commands:
  login   Open a localhost page in the browser and request an access token
  login-sa Create an access token from service account credentials in .env.test
  picker  Open Google Picker popup to select a spreadsheet and print its ID
  get     Read spreadsheet metadata and print a workout summary
  logout  Revoke the current access token in Google OAuth

Token resolution for get/logout:
  1) --token <ACCESS_TOKEN>
  2) GOOGLE_TOKEN environment variable

Environment:
  VITE_GOOGLE_CLIENT_ID is loaded from process env or local .env
  VITE_GOOGLE_API_KEY is used by picker (recommended for shared file browsing)
`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  const positional = [];

  for (let i = 0; i < rest.length; i += 1) {
    const part = rest[i];
    if (part.startsWith('--')) {
      const [rawKey, inlineValue] = part.split('=', 2);
      const key = rawKey.slice(2);
      if (inlineValue !== undefined) {
        flags[key] = inlineValue;
        continue;
      }
      const next = rest[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
        continue;
      }
      flags[key] = next;
      i += 1;
      continue;
    }
    positional.push(part);
  }

  return { command, positional, flags };
}

function parseDotEnv(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function getEnvValue(key, files = ['.env']) {
  if (process.env[key]) return process.env[key];
  for (const file of files) {
    try {
      const envContent = await readFile(file, 'utf8');
      const parsed = parseDotEnv(envContent);
      if (parsed[key]) return parsed[key];
    } catch {
      // Ignore missing env files
    }
  }
  return undefined;
}

function getToken(flags) {
  return flags.token || process.env.GOOGLE_TOKEN;
}

function openBrowser(url) {
  const platform = process.platform;
  if (platform === 'darwin') {
    return spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
  }
  if (platform === 'win32') {
    return spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref();
  }
  return spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function html(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildLoginPage({ clientId, scope, postUrl, doneUrl }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Google CLI Login</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f4f7f2; color: #182113; }
    .wrap { max-width: 640px; margin: 6vh auto; padding: 24px; }
    .card { background: white; border-radius: 14px; padding: 20px; box-shadow: 0 12px 32px rgba(24,33,19,.08); border: 1px solid #dce7d2; }
    h1 { margin: 0 0 8px; font-size: 20px; }
    p { line-height: 1.45; margin: 8px 0; }
    code { background: #eef4e8; padding: 2px 6px; border-radius: 6px; }
    button { margin-top: 14px; background: #8bc34a; border: none; color: #132008; padding: 10px 14px; border-radius: 10px; font-weight: 700; cursor: pointer; }
    button:hover { filter: brightness(.97); }
    .muted { color: #516048; font-size: 13px; }
    .err { color: #9b2721; white-space: pre-wrap; font-size: 14px; }
    .ok { color: #1f6b2f; font-weight: 700; }
  </style>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Google OAuth for CLI</h1>
      <p>This page requests an access token and sends it back to your local CLI process.</p>
      <p class="muted">Client ID: <code>${escapeHtml(clientId)}</code></p>
      <p class="muted">Scopes: <code>${escapeHtml(scope)}</code></p>
      <button id="loginBtn" type="button">Sign in with Google</button>
      <p id="status" class="muted">Waiting for sign-in...</p>
      <pre id="error" class="err"></pre>
    </div>
  </div>
  <script>
    const statusEl = document.getElementById('status');
    const errEl = document.getElementById('error');
    const btn = document.getElementById('loginBtn');
    let tokenClient;

    function setStatus(text, ok) {
      statusEl.textContent = text;
      statusEl.className = ok ? 'ok' : 'muted';
    }

    function setError(text) {
      errEl.textContent = text || '';
    }

    async function sendToken(response) {
      const res = await fetch(${JSON.stringify(postUrl)}, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response)
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error('Local CLI server rejected token: ' + msg);
      }
      return res.json();
    }

    function init() {
      if (!window.google?.accounts?.oauth2) {
        setError('Google Identity Services script failed to load.');
        return;
      }

      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: ${JSON.stringify(clientId)},
        scope: ${JSON.stringify(scope)},
        callback: async (response) => {
          if (response.error) {
            setError(JSON.stringify(response, null, 2));
            setStatus('Login failed', false);
            return;
          }

          try {
            setStatus('Received token, sending to CLI...', false);
            await sendToken(response);
            setStatus('Success. You can return to the terminal.', true);
            window.location.href = ${JSON.stringify(doneUrl)};
          } catch (err) {
            setError(String(err && err.stack ? err.stack : err));
            setStatus('Failed to send token to CLI', false);
          }
        }
      });

      btn.disabled = false;
    }

    btn.disabled = true;
    btn.addEventListener('click', () => {
      setError('');
      setStatus('Opening Google sign-in...', false);
      tokenClient.requestAccessToken({ prompt: 'consent' });
    });

    window.addEventListener('load', init);
  </script>
</body>
</html>`;
}

function buildPickerPage({ clientId, apiKey, scope, selectPostUrl, doneUrl, initialAccessToken }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Google Sheet Picker for CLI</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f4f7f2; color: #182113; }
    .wrap { max-width: 720px; margin: 6vh auto; padding: 24px; }
    .card { background: white; border-radius: 14px; padding: 20px; box-shadow: 0 12px 32px rgba(24,33,19,.08); border: 1px solid #dce7d2; }
    h1 { margin: 0 0 8px; font-size: 20px; }
    p { line-height: 1.45; margin: 8px 0; }
    code { background: #eef4e8; padding: 2px 6px; border-radius: 6px; }
    button { margin-top: 14px; background: #8bc34a; border: none; color: #132008; padding: 10px 14px; border-radius: 10px; font-weight: 700; cursor: pointer; }
    button[disabled] { opacity: .55; cursor: not-allowed; }
    .muted { color: #516048; font-size: 13px; }
    .err { color: #9b2721; white-space: pre-wrap; font-size: 14px; }
    .ok { color: #1f6b2f; font-weight: 700; }
    .warn { color: #9a6a14; }
  </style>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <script src="https://apis.google.com/js/api.js" async defer></script>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Google Picker for CLI</h1>
      <p>This page signs in, opens the Google file picker, and sends the selected sheet ID back to your local CLI process.</p>
      <p class="muted">Client ID: <code>${escapeHtml(clientId)}</code></p>
      <p class="muted">Scopes: <code>${escapeHtml(scope)}</code></p>
      <p class="muted">API key configured for picker.</p>
      <button id="pickerBtn" type="button" disabled>${initialAccessToken ? 'Open Spreadsheet Picker (reuse token)' : 'Open Spreadsheet Picker'}</button>
      <p id="status" class="muted">Loading Google APIs...</p>
      <pre id="error" class="err"></pre>
    </div>
  </div>
  <script>
    const btn = document.getElementById('pickerBtn');
    const statusEl = document.getElementById('status');
    const errEl = document.getElementById('error');
    let tokenClient;
    let pickerReady = false;
    let gisReady = false;
    let accessToken = ${JSON.stringify(initialAccessToken || '')};

    function setStatus(text, ok) {
      statusEl.textContent = text;
      statusEl.className = ok ? 'ok' : 'muted';
    }

    function setError(text) {
      errEl.textContent = text || '';
    }

    function updateButtonState() {
      btn.disabled = !(pickerReady && gisReady);
      if (!btn.disabled) {
        setStatus(accessToken ? 'Ready. Click to open picker using existing token.' : 'Ready. Click to sign in and pick a spreadsheet.', false);
      }
    }

    async function postSelection(payload) {
      const res = await fetch(${JSON.stringify(selectPostUrl)}, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error('Local CLI server rejected selection: ' + msg);
      }
      return res.json();
    }

    function pickerCallback(data) {
      try {
        if (data.action === google.picker.Action.CANCEL) {
          setStatus('Picker closed without selection.', false);
          return;
        }
        if (data.action !== google.picker.Action.PICKED) {
          return;
        }
        const doc = (data.docs && data.docs[0]) || {};
        const payload = {
          id: doc.id || '',
          name: doc.name || '',
          url: doc.url || ''
        };
        if (!payload.id) {
          throw new Error('Picker did not return a spreadsheet ID.');
        }
        setStatus('Spreadsheet selected, sending to CLI...', false);
        postSelection(payload)
          .then(() => {
            setStatus('Success. You can return to the terminal.', true);
            window.location.href = ${JSON.stringify(doneUrl)};
          })
          .catch((err) => {
            setError(String(err && err.stack ? err.stack : err));
            setStatus('Failed to send selection to CLI', false);
          });
      } catch (err) {
        setError(String(err && err.stack ? err.stack : err));
        setStatus('Picker callback failed', false);
      }
    }

    function openPicker() {
      setStatus('Opening Google Picker...', false);
      const ownedView = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
        .setMimeTypes('application/vnd.google-apps.spreadsheet')
        .setIncludeFolders(true)
        .setMode(google.picker.DocsViewMode.LIST)
        .setOwnedByMe(true)
        .setLabel('My Spreadsheets');

      const sharedView = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
        .setMimeTypes('application/vnd.google-apps.spreadsheet')
        .setIncludeFolders(true)
        .setMode(google.picker.DocsViewMode.LIST)
        .setOwnedByMe(false)
        .setLabel('Shared with me');

      const builder = new google.picker.PickerBuilder()
        .addView(ownedView)
        .addView(sharedView)
        .setOAuthToken(accessToken)
        .setCallback(pickerCallback);

      const apiKey = ${JSON.stringify(apiKey)};
      builder.setDeveloperKey(apiKey);

      builder.build().setVisible(true);
    }

    function requestTokenAndOpenPicker() {
      setError('');
      if (accessToken) {
        openPicker();
        return;
      }
      setStatus('Opening Google sign-in...', false);
      tokenClient.requestAccessToken({ prompt: 'consent' });
    }

    function initGis() {
      if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
        return false;
      }
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: ${JSON.stringify(clientId)},
        scope: ${JSON.stringify(scope)},
        callback: (response) => {
          if (response.error) {
            setError(JSON.stringify(response, null, 2));
            setStatus('Login failed', false);
            return;
          }
          accessToken = response.access_token || '';
          if (!accessToken) {
            setError('No access token returned by Google.');
            setStatus('Login failed', false);
            return;
          }
          openPicker();
        }
      });
      gisReady = true;
      updateButtonState();
      return true;
    }

    function initPickerApi() {
      if (!window.gapi || !window.gapi.load) {
        return false;
      }
      gapi.load('picker', () => {
        pickerReady = true;
        updateButtonState();
      });
      return true;
    }

    function pollInit() {
      const started = Date.now();
      const timer = setInterval(() => {
        if (!gisReady) initGis();
        if (!pickerReady) initPickerApi();
        if (gisReady && pickerReady) {
          clearInterval(timer);
          return;
        }
        if (Date.now() - started > 15000) {
          clearInterval(timer);
          setStatus('Failed to load Google APIs', false);
          setError('Timed out waiting for Google Identity Services and Picker APIs.');
        }
      }, 100);
    }

    btn.addEventListener('click', requestTokenAndOpenPicker);
    window.addEventListener('load', pollInit);
  </script>
</body>
</html>`;
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function fetchUserInfo(accessToken) {
  try {
    return await fetchJson('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }
}

async function fetchTokenInfo(accessToken) {
  try {
    return await fetchJson(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  } catch {
    return null;
  }
}

async function describePrincipal(accessToken) {
  const userInfo = await fetchUserInfo(accessToken);
  if (userInfo?.email || userInfo?.name) {
    return userInfo.email && userInfo.name
      ? `${userInfo.name} <${userInfo.email}>`
      : (userInfo.email || userInfo.name);
  }

  const tokenInfo = await fetchTokenInfo(accessToken);
  if (tokenInfo?.email) {
    return tokenInfo.email;
  }

  if (tokenInfo?.sub) {
    return `subject:${tokenInfo.sub}`;
  }

  const serviceAccountEmail = await getEnvValue('GOOGLE_SERVICE_ACCOUNT_EMAIL', ['.env.test']);
  if (serviceAccountEmail) {
    return `${serviceAccountEmail} (service account)`;
  }

  return '(unknown principal)';
}

async function cmdLogin(flags) {
  const clientId = await getEnvValue('VITE_GOOGLE_CLIENT_ID', ['.env']);
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID not found in environment or .env');
  }

  const port = Number(flags.port || DEFAULT_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: ${flags.port}`);
  }

  const scope = PICKER_SCOPES.join(' ');
  let resolveToken;
  let rejectToken;
  const tokenPromise = new Promise((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });

  let settled = false;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    if (req.method === 'GET' && url.pathname === LOGIN_PATH) {
      const loginPage = buildLoginPage({
        clientId,
        scope,
        postUrl: TOKEN_PATH,
        doneUrl: DONE_PATH,
      });
      html(res, 200, loginPage);
      return;
    }

    if (req.method === 'GET' && url.pathname === DONE_PATH) {
      html(res, 200, '<!doctype html><meta charset="utf-8"><title>Done</title><p>Token sent to CLI. You can close this tab.</p>');
      return;
    }

    if (req.method === 'POST' && url.pathname === TOKEN_PATH) {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 64 * 1024) {
          req.destroy(new Error('Request too large'));
        }
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (!payload.access_token) {
            json(res, 400, { error: 'Missing access_token' });
            return;
          }
          json(res, 200, { ok: true });
          if (!settled) {
            settled = true;
            resolveToken(payload);
          }
        } catch (err) {
          json(res, 400, { error: err.message });
        }
      });
      req.on('error', (err) => {
        if (!settled) {
          settled = true;
          rejectToken(err);
        }
      });
      return;
    }

    html(res, 404, '<!doctype html><p>Not found</p>');
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  const loginUrl = `http://localhost:${port}${LOGIN_PATH}`;
  console.log(`Opening browser for Google login at ${loginUrl}`);
  console.log(`If it does not open, visit: ${loginUrl}`);
  openBrowser(loginUrl);

  const timeout = setTimeout(() => {
    if (!settled) {
      settled = true;
      rejectToken(new Error(`Login timed out after ${LOGIN_TIMEOUT_MS / 1000}s`));
    }
  }, LOGIN_TIMEOUT_MS);

  try {
    const tokenResponse = await tokenPromise;
    const accessToken = tokenResponse.access_token;
    const userInfo = await fetchUserInfo(accessToken);

    console.log('');
    if (userInfo?.email || userInfo?.name) {
      console.log(`Logged in as: ${userInfo.name || '(no name)'}${userInfo.email ? ` <${userInfo.email}>` : ''}`);
    }
    console.log(`Token type: ${tokenResponse.token_type || 'Bearer'}`);
    if (tokenResponse.expires_in) {
      console.log(`Expires in: ${tokenResponse.expires_in}s`);
    }
    console.log(`Scope: ${tokenResponse.scope || scope}`);
    console.log('');
    console.log('Access token (not persisted):');
    console.log(accessToken);
    console.log('');
    console.log('Copy/paste into your shell:');
    console.log(`export GOOGLE_TOKEN='${accessToken.replaceAll("'", "'\\''")}'`);
  } finally {
    clearTimeout(timeout);
    await new Promise((resolve) => server.close(() => resolve()));
  }
}

async function cmdLoginSa() {
  const serviceAccountEmail = await getEnvValue('GOOGLE_SERVICE_ACCOUNT_EMAIL', ['.env.test']);
  const privateKeyRaw = await getEnvValue('GOOGLE_PRIVATE_KEY', ['.env.test']);

  if (!serviceAccountEmail || !privateKeyRaw) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY in environment/.env.test');
  }

  const { accessToken, tokenResponse } = await mintServiceAccountAccessToken({
    serviceAccountEmail,
    privateKeyRaw,
    scopes: PICKER_SCOPES,
  });

  console.log(`Service account: ${serviceAccountEmail}`);
  if (tokenResponse.expiry_date) {
    const expiryIso = new Date(tokenResponse.expiry_date).toISOString();
    console.log(`Expires at: ${expiryIso}`);
  }
  console.log(`Scope: ${PICKER_SCOPES.join(' ')}`);
  console.log('');
  console.log('Access token (not persisted):');
  console.log(accessToken);
  console.log('');
  console.log('Copy/paste into your shell:');
  console.log(`export GOOGLE_TOKEN='${accessToken.replaceAll("'", "'\\''")}'`);
}

async function cmdPicker(flags) {
  const clientId = await getEnvValue('VITE_GOOGLE_CLIENT_ID', ['.env']);
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID not found in environment or .env');
  }
  const apiKey = await getEnvValue('VITE_GOOGLE_API_KEY', ['.env']);
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    throw new Error('VITE_GOOGLE_API_KEY not found in .env (required for picker)');
  }
  const existingToken = getToken(flags);

  const port = Number(flags.port || DEFAULT_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: ${flags.port}`);
  }

  const scope = PICKER_SCOPES.join(' ');
  let resolveSelection;
  let rejectSelection;
  const selectionPromise = new Promise((resolve, reject) => {
    resolveSelection = resolve;
    rejectSelection = reject;
  });

  let settled = false;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);

    if (req.method === 'GET' && url.pathname === PICKER_PATH) {
      html(res, 200, buildPickerPage({
        clientId,
        apiKey,
        scope,
        selectPostUrl: PICKER_SELECT_PATH,
        doneUrl: PICKER_DONE_PATH,
        initialAccessToken: existingToken,
      }));
      return;
    }

    if (req.method === 'GET' && url.pathname === PICKER_DONE_PATH) {
      html(res, 200, '<!doctype html><meta charset="utf-8"><title>Done</title><p>Spreadsheet selection sent to CLI. You can close this tab.</p>');
      return;
    }

    if (req.method === 'POST' && url.pathname === PICKER_SELECT_PATH) {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 64 * 1024) {
          req.destroy(new Error('Request too large'));
        }
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (!payload.id) {
            json(res, 400, { error: 'Missing selected sheet id' });
            return;
          }
          json(res, 200, { ok: true });
          if (!settled) {
            settled = true;
            resolveSelection(payload);
          }
        } catch (err) {
          json(res, 400, { error: err.message });
        }
      });
      req.on('error', (err) => {
        if (!settled) {
          settled = true;
          rejectSelection(err);
        }
      });
      return;
    }

    html(res, 404, '<!doctype html><p>Not found</p>');
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  const pickerUrl = `http://localhost:${port}${PICKER_PATH}`;
  console.log(`Opening browser for Google Picker at ${pickerUrl}`);
  console.log(`If it does not open, visit: ${pickerUrl}`);
  if (existingToken) {
    console.log('Reusing token from GOOGLE_TOKEN/--token for picker (no login prompt unless token is invalid).');
  }
  openBrowser(pickerUrl);

  const timeout = setTimeout(() => {
    if (!settled) {
      settled = true;
      rejectSelection(new Error(`Picker timed out after ${PICKER_TIMEOUT_MS / 1000}s`));
    }
  }, PICKER_TIMEOUT_MS);

  try {
    const selection = await selectionPromise;
    const sheetId = selection.id;
    console.log('');
    console.log(`Selected sheet ID: ${sheetId}`);
    if (selection.name) {
      console.log(`Name: ${selection.name}`);
    }
    console.log(`Google Sheets URL: https://docs.google.com/spreadsheets/d/${sheetId}`);
    console.log('');
    console.log('Use with:');
    console.log(`node scripts/google-dev-cli.mjs get ${sheetId}`);
  } finally {
    clearTimeout(timeout);
    await new Promise((resolve) => server.close(() => resolve()));
  }
}

function createSheetsClient(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth });
}

function summarizeWorkoutLog(rows, headers) {
  if (!rows.length) {
    return {
      totalRows: 0,
      distinctDates: 0,
      sections: [],
      exercises: 0,
      dateRange: null,
    };
  }

  const dateIndex = headers.indexOf('Date');
  const sectionIndex = headers.indexOf('Section');
  const exerciseIndex = headers.indexOf('Exercise');

  const dateSet = new Set();
  const sectionCounts = new Map();
  const exerciseSet = new Set();
  let minDate = null;
  let maxDate = null;

  for (const row of rows) {
    const date = dateIndex >= 0 ? row[dateIndex] : '';
    const section = sectionIndex >= 0 ? row[sectionIndex] : '';
    const exercise = exerciseIndex >= 0 ? row[exerciseIndex] : '';

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      dateSet.add(date);
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }
    if (section) {
      sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1);
    }
    if (exercise) {
      exerciseSet.add(exercise);
    }
  }

  const sections = [...sectionCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));

  return {
    totalRows: rows.length,
    distinctDates: dateSet.size,
    sections,
    exercises: exerciseSet.size,
    dateRange: minDate && maxDate ? { min: minDate, max: maxDate } : null,
  };
}

async function cmdGet(sheetId, flags) {
  if (!sheetId) {
    throw new Error('Missing SHEET_ID. Usage: get <SHEET_ID>');
  }

  const accessToken = getToken(flags);
  if (!accessToken) {
    throw new Error('Missing token. Set GOOGLE_TOKEN or pass --token <ACCESS_TOKEN>.');
  }

  const principal = await describePrincipal(accessToken);
  const sheets = createSheetsClient(accessToken);

  const [metadata, batch] = await Promise.all([
    sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'properties.title,sheets.properties',
    }),
    sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges: ['WorkoutLog!1:1', 'WorkoutLog!A2:Z', 'Exercises!1:1', 'Exercises!A2:Z'],
      majorDimension: 'ROWS',
    }),
  ]);

  const valueRanges = batch.data.valueRanges || [];
  const workoutHeaders = valueRanges[0]?.values?.[0] || [];
  const workoutRows = valueRanges[1]?.values || [];
  const exerciseHeaders = valueRanges[2]?.values?.[0] || [];
  const exerciseRows = valueRanges[3]?.values || [];

  const summary = summarizeWorkoutLog(workoutRows, workoutHeaders);
  const sheetNames = (metadata.data.sheets || []).map((s) => s.properties?.title).filter(Boolean);

  console.log(`Retrieved sheet as ${principal}`);
  console.log(`Spreadsheet: ${metadata.data.properties?.title || '(untitled)'}`);
  console.log(`ID: ${sheetId}`);
  console.log(`Sheets: ${sheetNames.join(', ') || '(none)'}`);
  console.log('');
  console.log('WorkoutLog');
  console.log(`- Headers (${workoutHeaders.length}): ${workoutHeaders.join(', ') || '(none)'}`);
  console.log(`- Rows: ${summary.totalRows}`);
  console.log(`- Distinct workout dates: ${summary.distinctDates}`);
  if (summary.dateRange) {
    console.log(`- Date range: ${summary.dateRange.min} -> ${summary.dateRange.max}`);
  }
  console.log(`- Distinct exercises referenced: ${summary.exercises}`);
  if (summary.sections.length) {
    const topSections = summary.sections.slice(0, 8).map(({ name, count }) => `${name} (${count})`);
    console.log(`- Top sections: ${topSections.join(', ')}`);
  }

  console.log('');
  console.log('Exercises');
  console.log(`- Headers (${exerciseHeaders.length}): ${exerciseHeaders.join(', ') || '(none)'}`);
  console.log(`- Rows: ${exerciseRows.length}`);
}

async function cmdLogout(flags) {
  const accessToken = getToken(flags);
  if (!accessToken) {
    throw new Error('Missing token. Set GOOGLE_TOKEN or pass --token <ACCESS_TOKEN>.');
  }

  const body = new URLSearchParams({ token: accessToken });
  const response = await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to revoke token: HTTP ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`);
  }

  console.log('Token revoked in Google OAuth.');
  console.log('You can remove it from your shell with:');
  console.log('unset GOOGLE_TOKEN');
}

async function main() {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));

  if (!command || command === 'help' || flags.help) {
    printHelp();
    return;
  }

  if (command === 'login') {
    await cmdLogin(flags);
    return;
  }

  if (command === 'picker') {
    await cmdPicker(flags);
    return;
  }

  if (command === 'get') {
    await cmdGet(positional[0], flags);
    return;
  }

  if (command === 'login-sa') {
    await cmdLoginSa();
    return;
  }

  if (command === 'logout') {
    await cmdLogout(flags);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
});
