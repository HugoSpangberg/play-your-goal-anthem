import { useEffect, useMemo, useState } from 'react';
import { CountryFlag } from './CountryFlag';
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
  const [searchQuery, setSearchQuery] = useState('');

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
    return (
      <section className="match-section" aria-labelledby="matches-title">
        <div className="match-section__header">
          <div>
            <p className="step-label">Matches</p>
            <h2 id="matches-title">Select a match</h2>
          </div>
        </div>
        <div className="match-grid" aria-label="Loading matches">
          {[0, 1, 2].map((item) => (
            <div className="match-card match-card--skeleton" key={item}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="match-section" aria-labelledby="matches-title">
        <div className="match-section__header">
          <div>
            <p className="step-label">Matches</p>
            <h2 id="matches-title">Select a match</h2>
          </div>
        </div>
        <p className="state-message state-message--error" role="alert">
          {state.message}
        </p>
      </section>
    );
  }

  return (
    <MatchBrowser
      isRefreshing={state.isRefreshing}
      onMatchSelect={onMatchSelect}
      onRefresh={refreshMatches}
      response={state.response}
      searchQuery={searchQuery}
      selectedMatchId={selectedMatchId}
      setSearchQuery={setSearchQuery}
    />
  );
}

function MatchBrowser({
  isRefreshing,
  onMatchSelect,
  onRefresh,
  response,
  searchQuery,
  selectedMatchId,
  setSearchQuery,
}: {
  isRefreshing: boolean;
  // eslint-disable-next-line no-unused-vars
  onMatchSelect: (match: DemoMatch) => void;
  onRefresh: () => void;
  response: MatchesResponse;
  searchQuery: string;
  selectedMatchId?: string;
  // eslint-disable-next-line no-unused-vars
  setSearchQuery: (value: string) => void;
}) {
  const groupedMatches = useMemo(() => groupMatches(filterMatches(response.matches, searchQuery)), [response.matches, searchQuery]);
  const hasMatches = response.matches.length > 0;
  const hasFilteredMatches = groupedMatches.length > 0;

  return (
    <section className="match-section" aria-labelledby="matches-title">
      <div className="match-section__header">
        <div>
          <p className="step-label">Matches</p>
          <h2 id="matches-title">Select a match</h2>
          <div className="match-source-row">
            <span className="status-chip">{formatSource(response.source)}</span>
            <span>
              Updated <time dateTime={response.fetchedAt}>{formatFreshness(response.fetchedAt)}</time>
            </span>
            <button className="text-action" disabled={isRefreshing} onClick={onRefresh} type="button">
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          {response.isFallback || response.message ? (
            <p className="match-source match-source--fallback" role={response.isFallback ? 'status' : undefined}>
              {response.message ?? 'Fallback data is currently shown.'}
            </p>
          ) : null}
        </div>
        <label className="match-search">
          <span>Search country</span>
          <input
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            placeholder="Search team or country"
            type="search"
            value={searchQuery}
          />
        </label>
      </div>

      {!hasMatches ? <p className="state-message">No matches are available from this source.</p> : null}
      {hasMatches && !hasFilteredMatches ? (
        <p className="state-message">No matches found for “{searchQuery.trim()}”.</p>
      ) : null}

      {groupedMatches.map((group) => (
        <section className="match-date-group" key={group.key} aria-labelledby={`match-date-${group.key}`}>
          <h3 id={`match-date-${group.key}`}>{group.label}</h3>
          <div className="match-grid">
            {group.matches.map((match) => (
              <MatchCard
                isSelected={match.id === selectedMatchId}
                key={match.id}
                match={match}
                onSelect={() => onMatchSelect(match)}
              />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function MatchCard({ isSelected, match, onSelect }: { isSelected: boolean; match: DemoMatch; onSelect: () => void }) {
  return (
    <button
      aria-label={`${match.homeTeam.name} versus ${match.awayTeam.name}, ${formatKickoff(match.kickoffTime)}`}
      aria-pressed={isSelected}
      className="match-card"
      data-selected={isSelected}
      onClick={onSelect}
      type="button"
    >
      <span className="match-card__teams">
        <span className="match-card__team">
          <CountryFlag countryCode={match.homeTeam.countryCode} countryName={match.homeTeam.name} decorative />
          <span>{match.homeTeam.name}</span>
        </span>
        <span className="match-card__team">
          <CountryFlag countryCode={match.awayTeam.countryCode} countryName={match.awayTeam.name} decorative />
          <span>{match.awayTeam.name}</span>
        </span>
      </span>
      <span className="match-card__footer">
        <time dateTime={match.kickoffTime}>{formatKickoff(match.kickoffTime)}</time>
        <span className="status-chip">{formatStatus(match.status)}</span>
      </span>
      <span className="match-card__selection">{isSelected ? 'Selected' : 'Choose'}</span>
    </button>
  );
}

function filterMatches(matches: DemoMatch[], searchQuery: string) {
  const query = searchQuery.trim().toLowerCase();
  const sorted = [...matches].sort((first, second) => {
    const kickoffComparison = new Date(first.kickoffTime).getTime() - new Date(second.kickoffTime).getTime();
    return kickoffComparison === 0 ? first.id.localeCompare(second.id) : kickoffComparison;
  });

  if (!query) {
    return sorted;
  }

  return sorted.filter(
    (match) => match.homeTeam.name.toLowerCase().includes(query) || match.awayTeam.name.toLowerCase().includes(query),
  );
}

function groupMatches(matches: DemoMatch[]) {
  const groups = new Map<string, DemoMatch[]>();

  for (const match of matches) {
    const date = new Date(match.kickoffTime);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }

  return [...groups.entries()].map(([key, groupMatches]) => ({
    key,
    label: formatDateGroup(groupMatches[0].kickoffTime),
    matches: groupMatches,
  }));
}

function formatSource(source: MatchesResponse['source']) {
  return source === 'liveWorldCup' ? 'World Cup fixtures' : 'Demo fixtures';
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
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDateGroup(value: string) {
  const date = new Date(value);
  const today = startOfLocalDay(new Date());
  const target = startOfLocalDay(date);
  const dayDifference = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (dayDifference === 0) {
    return 'Today';
  }

  if (dayDifference === 1) {
    return 'Tomorrow';
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function formatStatus(status: DemoMatch['status']) {
  switch (status) {
    case 'playable':
      return 'Playable';
    case 'live':
      return 'Live';
    case 'finished':
      return 'Finished';
    default:
      return 'Upcoming';
  }
}
