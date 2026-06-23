import { afterEach, describe, expect, it, vi } from 'vitest';
import { type SpotifyTrack } from './spotifyApi';
import { type SpotifyTokenState } from './spotifyAuth';

const token: SpotifyTokenState = {
  accessToken: 'access-token',
  expiresAt: Date.now() + 60_000,
  refreshToken: 'refresh-token',
};

const track: SpotifyTrack = {
  album: 'Album',
  artists: 'Artist',
  artworkUrl: 'https://i.scdn.co/image/cover',
  durationMs: 180_000,
  explicit: false,
  externalUrl: 'https://open.spotify.com/track/track-id',
  id: 'track-id',
  name: 'Track',
  uri: 'spotify:track:track-id',
};

describe('spotifyPlayer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    delete window.Spotify;
    delete window.onSpotifyWebPlaybackSDKReady;
  });

  it('loads the Spotify Web Playback SDK script only once', async () => {
    vi.resetModules();
    const { loadSpotifyPlaybackSdk } = await import('./spotifyPlayer');

    const firstLoad = loadSpotifyPlaybackSdk();
    const secondLoad = loadSpotifyPlaybackSdk();

    expect(document.querySelectorAll('script[src="https://sdk.scdn.co/spotify-player.js"]')).toHaveLength(1);

    window.Spotify = { Player: vi.fn() as never };
    window.onSpotifyWebPlaybackSDKReady?.();

    await expect(firstLoad).resolves.toBeUndefined();
    await expect(secondLoad).resolves.toBeUndefined();
  });

  it('creates one player, does not autoplay, and cleans up listeners on disconnect', async () => {
    vi.resetModules();
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    // eslint-disable-next-line no-unused-vars
    const addListenerSpy = vi.fn((event: string, callback: (payload?: unknown) => void) => {
      if (event === 'ready') {
        callback({ device_id: 'device-id' });
      }

      return true;
    });
    const removeListenerSpy = vi.fn(() => true);
    const disconnectSpy = vi.fn();
    const connectSpy = vi.fn().mockResolvedValue(true);
    const playerConstructor = vi.fn(function PlayerMock() {
      return {
        addListener: addListenerSpy,
        connect: connectSpy,
        disconnect: disconnectSpy,
        removeListener: removeListenerSpy,
      };
    });

    vi.stubGlobal('fetch', fetchSpy);
    window.Spotify = { Player: playerConstructor as never };
    const { createSpotifyPlayer } = await import('./spotifyPlayer');

    const controller = await createSpotifyPlayer(token);

    expect(playerConstructor).toHaveBeenCalledTimes(1);
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();

    await controller.play(track, 42);
    const requestUrl = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)) as { position_ms: number; uris: string[] };

    expect(requestUrl.pathname).toBe('/v1/me/player/play');
    expect(requestUrl.searchParams.get('device_id')).toBe('device-id');
    expect(body).toEqual({ position_ms: 42_000, uris: ['spotify:track:track-id'] });

    controller.disconnect();

    expect(removeListenerSpy).toHaveBeenCalledWith('ready');
    expect(removeListenerSpy).toHaveBeenCalledWith('playback_error');
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toBe('idle');
  });

  it('reports Premium or developer-authorization account errors explicitly', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    window.Spotify = {
      Player: vi.fn(function PlayerMock() {
        return {
          addListener: vi.fn(() => true),
          connect: vi.fn().mockResolvedValue(true),
          disconnect: vi.fn(),
          removeListener: vi.fn(() => true),
        };
      }) as never,
    };
    const { createSpotifyPlayer } = await import('./spotifyPlayer');
    const controller = await createSpotifyPlayer(token);

    await expect(controller.play(track, 0)).rejects.toThrow('Spotify Premium or developer authorization is required.');

    expect(controller.getState()).toBe('account-error');
  });
});
