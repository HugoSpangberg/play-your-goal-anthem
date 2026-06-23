import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSpotifySession,
  createCodeChallenge,
  createSpotifyAuthorizationUrl,
  handleSpotifyCallback,
  readStoredToken,
  refreshSpotifyToken,
} from './spotifyAuth';

describe('spotifyAuth', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'spotify-client-id');
    vi.stubEnv('VITE_SPOTIFY_REDIRECT_URI', 'http://localhost:5173/callback');
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('creates the official PKCE SHA-256 challenge format', async () => {
    await expect(createCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).resolves.toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('builds a PKCE authorization URL without a client secret', async () => {
    const authorizationUrl = new URL(await createSpotifyAuthorizationUrl());

    expect(authorizationUrl.origin).toBe('https://accounts.spotify.com');
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.get('client_id')).toBe('spotify-client-id');
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorizationUrl.searchParams.has('client_secret')).toBe(false);
    expect(sessionStorage.getItem('goalanthem.spotify.pkceVerifier')).toBeTruthy();
    expect(sessionStorage.getItem('goalanthem.spotify.oauthState')).toBeTruthy();
  });

  it('validates OAuth state and stores session-scoped tokens after callback success', async () => {
    const authorizationUrl = new URL(await createSpotifyAuthorizationUrl());
    const state = authorizationUrl.searchParams.get('state');
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'access-token', expires_in: 3600, refresh_token: 'refresh-token' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const token = await handleSpotifyCallback(`http://localhost:5173/callback?code=code&state=${state}`);
    const body = fetchSpy.mock.calls[0]?.[1]?.body as URLSearchParams;

    expect(token?.accessToken).toBe('access-token');
    expect(token?.refreshToken).toBe('refresh-token');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.has('client_secret')).toBe(false);
    expect(readStoredToken()?.accessToken).toBe('access-token');
  });

  it('rejects invalid OAuth state and clears transient data', async () => {
    await createSpotifyAuthorizationUrl();

    await expect(handleSpotifyCallback('http://localhost:5173/callback?code=code&state=wrong-state')).rejects.toThrow(
      'Spotify authorization state could not be verified.',
    );

    expect(readStoredToken()).toBeNull();
    expect(sessionStorage.getItem('goalanthem.spotify.pkceVerifier')).toBeNull();
  });

  it('refreshes tokens without exposing a client secret and clears invalid refresh credentials', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'new-access', expires_in: 120 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 400 }));
    vi.stubGlobal('fetch', fetchSpy);

    const refreshed = await refreshSpotifyToken({
      accessToken: 'old-access',
      expiresAt: Date.now() - 1,
      refreshToken: 'refresh-token',
    });
    const body = fetchSpy.mock.calls[0]?.[1]?.body as URLSearchParams;

    expect(refreshed.accessToken).toBe('new-access');
    expect(refreshed.refreshToken).toBe('refresh-token');
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.has('client_secret')).toBe(false);

    await expect(
      refreshSpotifyToken({ accessToken: 'old-access', expiresAt: Date.now() - 1, refreshToken: 'expired-refresh' }),
    ).rejects.toThrow('Spotify session expired. Connect again.');
    expect(readStoredToken()).toBeNull();
  });

  it('clears Spotify tokens on disconnect cleanup', () => {
    sessionStorage.setItem(
      'goalanthem.spotify.tokens',
      JSON.stringify({ accessToken: 'access-token', expiresAt: Date.now() + 60_000, refreshToken: 'refresh-token' }),
    );

    clearSpotifySession();

    expect(readStoredToken()).toBeNull();
  });
});
