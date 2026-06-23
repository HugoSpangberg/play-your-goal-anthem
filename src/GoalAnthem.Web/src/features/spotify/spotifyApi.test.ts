import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchSpotifyTracks } from './spotifyApi';
import { type SpotifyTokenState } from './spotifyAuth';

const token: SpotifyTokenState = {
  accessToken: 'access-token',
  expiresAt: Date.now() + 60_000,
  refreshToken: 'refresh-token',
};

describe('spotifyApi', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'spotify-client-id');
    vi.stubEnv('VITE_SPOTIFY_REDIRECT_URI', 'http://localhost:5173/callback');
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('ignores empty or very short search queries', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(searchSpotifyTracks({ query: ' a ', token })).resolves.toMatchObject({ status: 'success', tracks: [] });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requests at most 10 tracks and maps small internal metadata only', async () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      album: {
        images: [{ height: 64, url: `https://i.scdn.co/image/${index}`, width: 64 }],
        name: `Album ${index}`,
      },
      artists: [{ name: 'Artist A' }, { name: 'Artist B' }],
      duration_ms: 180_000,
      explicit: index === 0,
      external_urls: { spotify: `https://open.spotify.com/track/${index}` },
      id: `track-${index}`,
      name: `Track ${index}`,
      uri: `spotify:track:${index}`,
    }));
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tracks: { items } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const result = await searchSpotifyTracks({ query: 'goal anthem', token });
    const requestUrl = new URL(String(fetchSpy.mock.calls[0]?.[0]));

    expect(requestUrl.searchParams.get('limit')).toBe('10');
    expect(fetchSpy.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer access-token' });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.tracks).toHaveLength(10);
      expect(result.tracks[0]).toEqual({
        album: 'Album 0',
        artists: 'Artist A, Artist B',
        artworkUrl: 'https://i.scdn.co/image/0',
        durationMs: 180_000,
        explicit: true,
        externalUrl: 'https://open.spotify.com/track/0',
        id: 'track-0',
        name: 'Track 0',
        uri: 'spotify:track:0',
      });
    }
  });

  it('handles authorization, account, and rate-limit states explicitly', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { headers: { 'Retry-After': '7' }, status: 429 }));
    vi.stubGlobal('fetch', fetchSpy);

    await expect(searchSpotifyTracks({ query: 'anthem', token })).resolves.toMatchObject({ status: 'unauthorized' });
    await expect(searchSpotifyTracks({ query: 'anthem', token })).resolves.toMatchObject({ status: 'forbidden' });
    await expect(searchSpotifyTracks({ query: 'anthem', token })).resolves.toMatchObject({
      retryAfterSeconds: 7,
      status: 'rate-limited',
    });
  });

  it('cancels superseded requests through the provided abort signal', async () => {
    const abortController = new AbortController();
    const fetchSpy = vi.fn().mockImplementation((_url: string, init: { signal?: AbortSignal }) => {
      expect(init.signal).toBe(abortController.signal);
      return Promise.resolve(new Response(JSON.stringify({ tracks: { items: [] } }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchSpy);

    await searchSpotifyTracks({ query: 'anthem', signal: abortController.signal, token });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
