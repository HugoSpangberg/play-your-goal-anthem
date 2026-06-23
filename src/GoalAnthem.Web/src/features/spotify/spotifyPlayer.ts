import { type SpotifyTokenState } from './spotifyAuth';
import { type SpotifyTrack } from './spotifyApi';

type SpotifyPlayerState = 'idle' | 'loading' | 'ready' | 'not-ready' | 'account-error' | 'auth-error' | 'playback-error';

export type SpotifyPlayerController = {
  disconnect: () => void;
  getState: () => SpotifyPlayerState;
  pause: () => Promise<void>;
  // eslint-disable-next-line no-unused-vars
  play: (track: SpotifyTrack, cuePointSeconds: number) => Promise<void>;
  resume: () => Promise<void>;
};

let sdkLoadPromise: Promise<void> | null = null;

declare global {
  interface Window {
    Spotify?: {
      // eslint-disable-next-line no-unused-vars
      Player: new (options: {
        // eslint-disable-next-line no-unused-vars
        getOAuthToken: (callback: (token: string) => void) => void;
        name: string;
      }) => SpotifyWebPlaybackPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

type SpotifyWebPlaybackPlayer = {
  // eslint-disable-next-line no-unused-vars
  addListener: (event: string, callback: (...args: unknown[]) => void) => boolean;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  // eslint-disable-next-line no-unused-vars
  removeListener: (event: string) => boolean;
};

export function loadSpotifyPlaybackSdk() {
  if (window.Spotify) {
    return Promise.resolve();
  }

  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  sdkLoadPromise = new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    script.onerror = () => reject(new Error('Spotify Web Playback SDK could not be loaded.'));
    document.body.append(script);
  });

  return sdkLoadPromise;
}

export async function createSpotifyPlayer(token: SpotifyTokenState): Promise<SpotifyPlayerController> {
  await loadSpotifyPlaybackSdk();

  if (!window.Spotify) {
    throw new Error('Spotify Web Playback SDK is unavailable.');
  }

  let state: SpotifyPlayerState = 'loading';
  let deviceId: string | null = null;
  const player = new window.Spotify.Player({
    getOAuthToken: (callback) => callback(token.accessToken),
    name: 'Play Your Goal Anthem setup player',
  });

  player.addListener('ready', (payload) => {
    deviceId = (payload as { device_id?: string }).device_id ?? null;
    state = 'ready';
  });
  player.addListener('not_ready', () => {
    state = 'not-ready';
  });
  player.addListener('initialization_error', () => {
    state = 'playback-error';
  });
  player.addListener('authentication_error', () => {
    state = 'auth-error';
  });
  player.addListener('account_error', () => {
    state = 'account-error';
  });
  player.addListener('playback_error', () => {
    state = 'playback-error';
  });

  const connected = await player.connect();
  if (!connected) {
    state = 'not-ready';
  }

  async function callPlayback(endpoint: string, init: { body?: string; headers?: Record<string, string>; method?: string } = {}) {
    const url = new URL(`https://api.spotify.com/v1/me/player/${endpoint}`);
    if (deviceId) {
      url.searchParams.set('device_id', deviceId);
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });

    if (response.status === 403) {
      state = 'account-error';
      throw new Error('Spotify Premium or developer authorization is required.');
    }

    if (response.status === 401) {
      state = 'auth-error';
      throw new Error('Spotify authorization expired.');
    }

    if (!response.ok && response.status !== 204) {
      state = 'playback-error';
      throw new Error('Spotify playback command failed.');
    }
  }

  return {
    disconnect: () => {
      player.removeListener('ready');
      player.removeListener('not_ready');
      player.removeListener('initialization_error');
      player.removeListener('authentication_error');
      player.removeListener('account_error');
      player.removeListener('playback_error');
      player.disconnect();
      state = 'idle';
    },
    getState: () => state,
    pause: () => callPlayback('pause', { method: 'PUT' }),
    play: (track, cuePointSeconds) =>
      callPlayback('play', {
        body: JSON.stringify({
          position_ms: cuePointSeconds * 1000,
          uris: [track.uri],
        }),
        method: 'PUT',
      }),
    resume: () => callPlayback('play', { method: 'PUT' }),
  };
}
