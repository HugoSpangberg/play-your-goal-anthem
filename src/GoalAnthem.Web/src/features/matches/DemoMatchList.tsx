import { useEffect, useState } from 'react';
import { DemoMatch, getDemoMatches } from './demoMatchesApi';

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; matches: DemoMatch[]; selectedMatchId?: string }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export function DemoMatchList() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const abortController = new AbortController();

    getDemoMatches(abortController.signal)
      .then((matches) => {
        setState(matches.length === 0 ? { status: 'empty' } : { status: 'loaded', matches });
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Demo matches could not be loaded.',
        });
      });

    return () => abortController.abort();
  }, []);

  if (state.status === 'loading') {
    return <p className="state-message">Loading demo matches...</p>;
  }

  if (state.status === 'empty') {
    return <p className="state-message">No demo matches are available.</p>;
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
      <div className="section-heading">
        <p className="step-label">Find match</p>
        <h2 id="matches-title">Select a demo match</h2>
      </div>
      <div className="match-grid">
        {state.matches.map((match) => {
          const isSelected = match.id === state.selectedMatchId;

          return (
            <button
              className="match-card"
              data-selected={isSelected}
              key={match.id}
              onClick={() => setState({ ...state, selectedMatchId: match.id })}
              type="button"
            >
              <span className="match-card__status">{match.status}</span>
              <span className="match-card__teams">
                {match.homeTeam.name} <span aria-hidden="true">vs</span> {match.awayTeam.name}
              </span>
              <time className="match-card__time" dateTime={match.kickoffTime}>
                {formatKickoff(match.kickoffTime)}
              </time>
              <span className="match-card__action">{isSelected ? 'Selected' : 'Choose match'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
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
