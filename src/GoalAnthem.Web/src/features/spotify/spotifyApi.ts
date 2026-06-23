import { getUsableSpotifyToken, type SpotifyTokenState } from './spotifyAuth';

export type SpotifyTrack = {
  album: string;
  artists: string;
  artworkUrl: string | null;
  durationMs: number;
  explicit: boolean;
  externalUrl: string;
  id: string;
  name: string;
  uri: string;
};

export type SpotifySearchResult =
  | { status: 'success'; tracks: SpotifyTrack[]; token: SpotifyTokenState }
  | { status: 'unauthorized' | 'forbidden'; message: string }
  | { status: 'rate-limited'; retryAfterSeconds: number; message: string };

export async function searchSpotifyTracks({
  query,
  signal,
  token,
}: {
  query: string;
  signal?: AbortSignal;
  token: SpotifyTokenState;
}): Promise<SpotifySearchResult> {
  const usableToken = await getUsableSpotifyToken(token);
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return { status: 'success', tracks: [], token: usableToken };
  }

  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('q', trimmedQuery);
  url.searchParams.set('type', 'track');
  url.searchParams.set('limit', '10');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${usableToken.accessToken}` },
    signal,
  });

  if (response.status === 401) {
    return { status: 'unauthorized', message: 'Spotify authorization expired. Connect again.' };
  }

  if (response.status === 403) {
    return { status: 'forbidden', message: 'Spotify rejected this account or scope. Premium and developer authorization may be required.' };
  }

  if (response.status === 429) {
    return {
      status: 'rate-limited',
      retryAfterSeconds: Number(response.headers.get('Retry-After') ?? '1'),
      message: 'Spotify rate limit reached. Try again after the retry window.',
    };
  }

  if (!response.ok) {
    return { status: 'forbidden', message: 'Spotify search is unavailable.' };
  }

  const payload = (await response.json()) as SpotifySearchResponse;
  return {
    status: 'success',
    token: usableToken,
    tracks: (payload.tracks?.items ?? []).slice(0, 10).map(mapTrack),
  };
}

function mapTrack(track: SpotifyTrackResponse): SpotifyTrack {
  const image = track.album.images.find((item) => item.url) ?? null;

  return {
    album: track.album.name,
    artists: track.artists.map((artist) => artist.name).join(', '),
    artworkUrl: image?.url ?? null,
    durationMs: track.duration_ms,
    explicit: track.explicit,
    externalUrl: track.external_urls.spotify,
    id: track.id,
    name: track.name,
    uri: track.uri,
  };
}

type SpotifySearchResponse = {
  tracks?: {
    items: SpotifyTrackResponse[];
  };
};

type SpotifyTrackResponse = {
  album: {
    images: Array<{ url: string; height: number | null; width: number | null }>;
    name: string;
  };
  artists: Array<{ name: string }>;
  duration_ms: number;
  explicit: boolean;
  external_urls: { spotify: string };
  id: string;
  name: string;
  uri: string;
};
