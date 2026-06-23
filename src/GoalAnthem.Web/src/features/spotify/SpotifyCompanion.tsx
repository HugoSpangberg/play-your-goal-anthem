import { useEffect, useRef, useState } from 'react';
import {
  clearSpotifySession,
  createSpotifyAuthorizationUrl,
  handleSpotifyCallback,
  readStoredToken,
  type SpotifyTokenState,
} from './spotifyAuth';
import { searchSpotifyTracks, type SpotifyTrack } from './spotifyApi';
import { getSpotifyConfig } from './spotifyConfig';
import { createSpotifyPlayer, type SpotifyPlayerController } from './spotifyPlayer';

type SpotifyCompanionProps = {
  cuePointSeconds?: number;
  // eslint-disable-next-line no-unused-vars
  onSelectTrack: (track: SpotifyTrack) => void;
  selectedTrack?: SpotifyTrack;
};

export function SpotifyCompanion({ cuePointSeconds = 0, onSelectTrack, selectedTrack }: SpotifyCompanionProps) {
  const config = getSpotifyConfig();
  const [token, setToken] = useState<SpotifyTokenState | null>(() => readStoredToken());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(config.isConfigured ? 'Spotify is optional and used only as a setup companion.' : 'Spotify is not configured.');
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [playerStatus, setPlayerStatus] = useState('Spotify player not loaded.');
  const playerRef = useRef<SpotifyPlayerController | null>(null);

  useEffect(() => {
    let isActive = true;
    handleSpotifyCallback()
      .then((nextToken) => {
        if (isActive && nextToken) {
          setToken(nextToken);
          setStatus('Spotify connected. Premium is required for the Web Playback SDK.');
        }
      })
      .catch((error) => {
        if (isActive) {
          setStatus(error instanceof Error ? error.message : 'Spotify authorization failed.');
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!token || query.trim().length < 2) {
      return undefined;
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);
      searchSpotifyTracks({ query, signal: abortController.signal, token })
        .then((result) => {
          if (result.status === 'success') {
            setToken(result.token);
            setTracks(result.tracks);
            setStatus('Spotify results loaded. Spotify content is not automatic goal audio.');
            return;
          }

          setTracks([]);
          setStatus(result.message);
        })
        .catch((error) => {
          if (!abortController.signal.aborted) {
            setStatus(error instanceof Error ? error.message : 'Spotify search failed.');
          }
        })
        .finally(() => setIsSearching(false));
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [query, token]);

  useEffect(
    () => () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    },
    [],
  );

  if (!config.isConfigured) {
    return (
      <section className="spotify-panel" aria-labelledby="spotify-title">
        <h4 id="spotify-title">Spotify companion</h4>
        <p>Spotify can be enabled by configuring the developer Client ID and redirect URI. Demo and local audio remain available.</p>
      </section>
    );
  }

  async function connect() {
    window.location.assign(await createSpotifyAuthorizationUrl());
  }

  function disconnect() {
    playerRef.current?.disconnect();
    playerRef.current = null;
    clearSpotifySession();
    setToken(null);
    setTracks([]);
    setPlayerStatus('Spotify player disconnected.');
    setStatus('Spotify disconnected.');
  }

  async function loadPlayer() {
    if (!token) {
      return;
    }

    try {
      playerRef.current = await createSpotifyPlayer(token);
      setPlayerStatus('Spotify player loaded. Use the controls manually during setup.');
    } catch (error) {
      setPlayerStatus(error instanceof Error ? error.message : 'Spotify player could not be loaded.');
    }
  }

  async function playSelectedTrack() {
    if (!selectedTrack || !playerRef.current) {
      return;
    }

    try {
      await playerRef.current.play(selectedTrack, cuePointSeconds);
      setPlayerStatus('Spotify setup playback started manually.');
    } catch (error) {
      setPlayerStatus(error instanceof Error ? error.message : 'Spotify playback failed.');
    }
  }

  async function pauseSelectedTrack() {
    try {
      await playerRef.current?.pause();
      setPlayerStatus('Spotify playback paused.');
    } catch (error) {
      setPlayerStatus(error instanceof Error ? error.message : 'Spotify pause failed.');
    }
  }

  return (
    <section className="spotify-panel" aria-labelledby="spotify-title">
      <div className="spotify-panel__header">
        <div>
          <h4 id="spotify-title">Spotify companion</h4>
          <p>{status}</p>
          <p>Spotify tracks are never played by goals, match clocks, SignalR events, or manual goal controls.</p>
        </div>
        {token ? (
          <button className="secondary-action" onClick={disconnect} type="button">
            Disconnect Spotify
          </button>
        ) : (
          <button className="secondary-action" onClick={() => void connect()} type="button">
            Connect Spotify
          </button>
        )}
      </div>

      {token ? (
        <>
          <label className="cue-input">
            <span>Search Spotify tracks</span>
            <input
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search by track or artist"
              type="search"
              value={query}
            />
          </label>
          {isSearching ? <p className="state-message">Searching Spotify...</p> : null}
          {tracks.length > 0 ? (
            <div className="spotify-results">
              {tracks.map((track) => (
                <button
                  aria-pressed={selectedTrack?.id === track.id}
                  className="spotify-track"
                  data-selected={selectedTrack?.id === track.id}
                  key={track.id}
                  onClick={() => onSelectTrack(track)}
                  type="button"
                >
                  {track.artworkUrl ? <img alt="" height="64" src={track.artworkUrl} width="64" /> : null}
                  <span>
                    <strong>{track.name}</strong>
                    <span>{track.artists}</span>
                    <span>
                      {track.album} · {formatDuration(track.durationMs)}
                      {track.explicit ? ' · Explicit' : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {selectedTrack ? (
        <div className="spotify-selection">
          <p>
            Selected Spotify companion: <strong>{selectedTrack.name}</strong> by {selectedTrack.artists}
          </p>
          <a href={selectedTrack.externalUrl} rel="noreferrer" target="_blank">
            Open in Spotify
          </a>
          {token ? (
            <div className="match-controls">
              <button className="secondary-action" onClick={() => void loadPlayer()} type="button">
                Load Spotify player
              </button>
              <button className="secondary-action" onClick={() => void playSelectedTrack()} type="button">
                Play selected track
              </button>
              <button className="secondary-action" onClick={() => void pauseSelectedTrack()} type="button">
                Pause Spotify
              </button>
            </div>
          ) : null}
          <p className="match-source">{playerStatus}</p>
          <p className="match-source">Content and metadata provided by Spotify.</p>
        </div>
      ) : null}
    </section>
  );
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
