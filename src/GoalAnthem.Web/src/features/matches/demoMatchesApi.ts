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
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5188';

export async function getDemoMatches(signal?: AbortSignal): Promise<DemoMatch[]> {
  const response = await fetch(`${apiBaseUrl}/api/demo-matches`, { signal });

  if (!response.ok) {
    throw new Error(`Demo matches could not be loaded. Status: ${response.status}`);
  }

  const matches = (await response.json()) as DemoMatch[];
  return matches;
}
