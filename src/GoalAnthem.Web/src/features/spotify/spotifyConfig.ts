export type SpotifyConfig = {
  clientId: string;
  isConfigured: boolean;
  redirectUri: string;
};

export const spotifyScopes = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
] as const;

export function getSpotifyConfig(): SpotifyConfig {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';
  const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI ?? window.location.origin;

  return {
    clientId,
    isConfigured: clientId.trim().length > 0,
    redirectUri,
  };
}
