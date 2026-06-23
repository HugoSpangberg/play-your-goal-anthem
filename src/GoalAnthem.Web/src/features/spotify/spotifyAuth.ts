import { getSpotifyConfig, spotifyScopes } from './spotifyConfig';

export type SpotifyTokenState = {
  accessToken: string;
  expiresAt: number;
  refreshToken: string | null;
};

const verifierKey = 'goalanthem.spotify.pkceVerifier';
const stateKey = 'goalanthem.spotify.oauthState';
const tokenKey = 'goalanthem.spotify.tokens';

export function generateCodeVerifier() {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function createCodeChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64Url(new Uint8Array(digest));
}

export function generateOAuthState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function createSpotifyAuthorizationUrl() {
  const config = getSpotifyConfig();
  if (!config.isConfigured) {
    throw new Error('Spotify is not configured.');
  }

  const verifier = generateCodeVerifier();
  const state = generateOAuthState();
  const challenge = await createCodeChallenge(verifier);
  sessionStorage.setItem(verifierKey, verifier);
  sessionStorage.setItem(stateKey, state);

  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('scope', spotifyScopes.join(' '));
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', challenge);

  return url.toString();
}

export async function handleSpotifyCallback(url = window.location.href): Promise<SpotifyTokenState | null> {
  const current = new URL(url);
  const error = current.searchParams.get('error');
  if (error) {
    clearSpotifySession();
    throw new Error(`Spotify authorization failed: ${error}`);
  }

  const code = current.searchParams.get('code');
  const returnedState = current.searchParams.get('state');
  if (!code && !returnedState) {
    return readStoredToken();
  }

  const expectedState = sessionStorage.getItem(stateKey);
  const verifier = sessionStorage.getItem(verifierKey);
  if (!code || !returnedState || !expectedState || returnedState !== expectedState || !verifier) {
    clearSpotifySession();
    throw new Error('Spotify authorization state could not be verified.');
  }

  const config = getSpotifyConfig();
  const body = new URLSearchParams({
    client_id: config.clientId,
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });

  if (!response.ok) {
    clearSpotifySession();
    throw new Error('Spotify authorization token exchange failed.');
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  const token = storeToken(payload.access_token, payload.expires_in, payload.refresh_token ?? null);
  sessionStorage.removeItem(verifierKey);
  sessionStorage.removeItem(stateKey);
  return token;
}

export async function refreshSpotifyToken(token: SpotifyTokenState): Promise<SpotifyTokenState> {
  if (!token.refreshToken) {
    clearSpotifySession();
    throw new Error('Spotify refresh credentials are unavailable.');
  }

  const config = getSpotifyConfig();
  const body = new URLSearchParams({
    client_id: config.clientId,
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
  });
  const response = await fetch('https://accounts.spotify.com/api/token', {
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });

  if (!response.ok) {
    clearSpotifySession();
    throw new Error('Spotify session expired. Connect again.');
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  return storeToken(payload.access_token, payload.expires_in, payload.refresh_token ?? token.refreshToken);
}

export function clearSpotifySession() {
  sessionStorage.removeItem(verifierKey);
  sessionStorage.removeItem(stateKey);
  sessionStorage.removeItem(tokenKey);
}

export function readStoredToken(): SpotifyTokenState | null {
  const value = sessionStorage.getItem(tokenKey);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as SpotifyTokenState;
  } catch {
    clearSpotifySession();
    return null;
  }
}

export async function getUsableSpotifyToken(token: SpotifyTokenState): Promise<SpotifyTokenState> {
  if (Date.now() < token.expiresAt - 30_000) {
    return token;
  }

  return refreshSpotifyToken(token);
}

function storeToken(accessToken: string, expiresInSeconds: number, refreshToken: string | null): SpotifyTokenState {
  const token = {
    accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1000,
    refreshToken,
  };
  sessionStorage.setItem(tokenKey, JSON.stringify(token));
  return token;
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}
