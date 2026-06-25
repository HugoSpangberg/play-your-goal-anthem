export type DemoMatch = {
  id: string;
  kickoffTime: string;
  status: 'upcoming' | 'playable' | 'live' | 'finished';
  homeTeam: Team;
  awayTeam: Team;
};

export type Team = {
  id: string;
  name: string;
  countryCode?: string | null;
};

export type MatchDataSource = 'demo' | 'liveWorldCup';

export type MatchesResponse = {
  matches: DemoMatch[];
  source: MatchDataSource;
  fetchedAt: string;
  isFallback: boolean;
  message: string | null;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export async function getMatches({ forceRefresh = false, signal }: { forceRefresh?: boolean; signal?: AbortSignal } = {}): Promise<MatchesResponse> {
  const url = new URL(`${apiBaseUrl}/api/matches`, window.location.origin);

  if (forceRefresh) {
    url.searchParams.set('refresh', 'true');
  }

  const response = await fetch(url.toString(), { signal });

  if (!response.ok) {
    throw new Error(`Matches could not be loaded. Status: ${response.status}`);
  }

  return (await response.json()) as MatchesResponse;
}
