import { useEffect, useState } from 'react';
import { DemoMatch, MatchesResponse, getMatches } from './demoMatchesApi';

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; response: MatchesResponse; isRefreshing: boolean }
  | { status: 'empty'; response: MatchesResponse; isRefreshing: boolean }
  | { status: 'error'; message: string };

type DemoMatchListProps = {
  // eslint-disable-next-line no-unused-vars
  onMatchSelect: (match: DemoMatch) => void;
  selectedMatchId?: string;
};

export function DemoMatchList({ onMatchSelect, selectedMatchId }: DemoMatchListProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const abortController = new AbortController();

    getMatches({ signal: abortController.signal })
      .then((response) => {
        setState(response.matches.length === 0 ? { status: 'empty', response, isRefreshing: false } : { status: 'loaded', response, isRefreshing: false });
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Matches could not be loaded.',
        });
      });

    return () => abortController.abort();
  }, []);

  async function refreshMatches() {
    if (state.status !== 'loaded' && state.status !== 'empty') {
      return;
    }

    setState({ ...state, isRefreshing: true });

    try {
      const response = await getMatches({ forceRefresh: true });
      setState(response.matches.length === 0 ? { status: 'empty', response, isRefreshing: false } : { status: 'loaded', response, isRefreshing: false });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Matches could not be refreshed.',
      });
    }
  }

  if (state.status === 'loading') {
    return <p className="state-message">Loading matches...</p>;
  }

  if (state.status === 'empty') {
    return (
      <section className="match-section" aria-labelledby="matches-title">
        <MatchSectionHeader response={state.response} isRefreshing={state.isRefreshing} onRefresh={refreshMatches} />
        <p className="state-message">No matches are available from this source.</p>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <p className="state-message state-message--error" role="alert">
        {state.message}
      </p>
    );
  }

  return (
    <section className="match-section" aria-labelledby="matches-title">
      <MatchSectionHeader response={state.response} isRefreshing={state.isRefreshing} onRefresh={refreshMatches} />
      <div className="match-grid">
        {state.response.matches.map((match) => {
          const isSelected = match.id === selectedMatchId;

          return (
            <button
              className="match-card"
              data-selected={isSelected}
              aria-pressed={isSelected}
              key={match.id}
              onClick={() => onMatchSelect(match)}
              type="button"
            >
              <span className="match-card__status">{match.status}</span>
              <span className="match-card__teams">
                {match.homeTeam.name} <span aria-hidden="true">vs</span> {match.awayTeam.name}
              </span>
              <time className="match-card__time" dateTime={match.kickoffTime}>
                {formatKickoff(match.kickoffTime)}
              </time>
              <span className="match-card__action">{isSelected ? 'Selected match' : 'Choose match'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MatchSectionHeader({
  isRefreshing,
  onRefresh,
  response,
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
  response: MatchesResponse;
}) {
  return (
    <div className="section-heading match-section__heading">
      <div>
        <p className="step-label">Find match</p>
        <h2 id="matches-title">Select a match</h2>
        <p className="match-source">
          {formatSource(response.source)}
          {' · '}
          Updated <time dateTime={response.fetchedAt}>{formatFreshness(response.fetchedAt)}</time>
        </p>
        {response.isFallback || response.message ? (
          <p className="match-source match-source--fallback" role={response.isFallback ? 'status' : undefined}>
            {response.message ?? 'Fallback data is currently shown.'}
          </p>
        ) : null}
      </div>
      <button className="secondary-action" disabled={isRefreshing} onClick={onRefresh} type="button">
        {isRefreshing ? 'Refreshing...' : 'Refresh matches'}
      </button>
    </div>
  );
}

function formatSource(source: MatchesResponse['source']) {
  return source === 'liveWorldCup' ? 'Live World Cup data' : 'Demo data';
}

function formatFreshness(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatKickoff(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
