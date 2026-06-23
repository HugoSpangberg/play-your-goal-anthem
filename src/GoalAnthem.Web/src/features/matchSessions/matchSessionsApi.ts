import { type DemoMatch, type Team } from '../matches/demoMatchesApi';
import { type MatchSpeed } from '../matchMode/matchSimulation';

export type MatchSessionEvent = {
  id: string;
  atSecond: number;
  type: 'kickoff' | 'goal' | 'half-time' | 'second-half' | 'full-time';
  label: string;
  teamId: string | null;
  homeScore: number;
  awayScore: number;
};

export type MatchSessionSnapshot = {
  sessionId: string;
  match: DemoMatch;
  supportedTeam: Team;
  speed: MatchSpeed;
  elapsedSeconds: number;
  homeScore: number;
  awayScore: number;
  status: 'live' | 'half-time' | 'ended';
  timeline: MatchSessionEvent[];
  updatedAt: string;
};

export type CreateMatchSessionResponse = {
  sessionId: string;
  snapshot: MatchSessionSnapshot;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export async function createMatchSession({
  match,
  signal,
  speed,
  supportedTeamId,
}: {
  match: DemoMatch;
  signal?: AbortSignal;
  speed: MatchSpeed;
  supportedTeamId: string;
}): Promise<CreateMatchSessionResponse> {
  const response = await fetch(`${apiBaseUrl}/api/match-sessions`, {
    body: JSON.stringify({ match, supportedTeamId, speed }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Match session could not be started. Status: ${response.status}`);
  }

  return (await response.json()) as CreateMatchSessionResponse;
}

export async function endMatchSession(sessionId: string): Promise<MatchSessionSnapshot> {
  const response = await fetch(`${apiBaseUrl}/api/match-sessions/${encodeURIComponent(sessionId)}/end`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Match session could not be ended. Status: ${response.status}`);
  }

  return (await response.json()) as MatchSessionSnapshot;
}
