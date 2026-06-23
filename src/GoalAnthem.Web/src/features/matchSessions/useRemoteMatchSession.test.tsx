import { StrictMode, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type DemoMatch } from '../matches/demoMatchesApi';
import { type MatchSessionEvent, type MatchSessionSnapshot } from './matchSessionsApi';
import { useRemoteMatchSession } from './useRemoteMatchSession';

const mocks = vi.hoisted(() => ({
  client: {
    joinSession: vi.fn(),
    leaveSession: vi.fn(),
    onClose: vi.fn(),
    onEventProcessed: vi.fn(),
    onReconnected: vi.fn(),
    onReconnecting: vi.fn(),
    onSessionEnded: vi.fn(),
    onSnapshotUpdated: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  },
  createMatchSession: vi.fn(),
  createSignalRMatchSessionClient: vi.fn(),
  endMatchSession: vi.fn(),
}));

vi.mock('./matchSessionsApi', async () => ({
  createMatchSession: mocks.createMatchSession,
  endMatchSession: mocks.endMatchSession,
}));

vi.mock('./signalRMatchSessionClient', () => ({
  createSignalRMatchSessionClient: mocks.createSignalRMatchSessionClient,
}));

const match: DemoMatch = {
  awayTeam: { id: 'eastgate-city', name: 'Eastgate City' },
  homeTeam: { id: 'north-harbor-fc', name: 'North Harbor FC' },
  id: 'demo-2026-summer-cup-001',
  kickoffTime: '2026-07-04T18:00:00+02:00',
  status: 'playable',
};

const snapshot: MatchSessionSnapshot = {
  awayScore: 0,
  elapsedSeconds: 0,
  homeScore: 0,
  match,
  sessionId: 'session-1',
  speed: 'demo',
  status: 'live',
  supportedTeam: match.homeTeam,
  timeline: [],
  updatedAt: '2026-06-24T12:00:00Z',
};

describe('useRemoteMatchSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSignalRMatchSessionClient.mockReturnValue(mocks.client);
    mocks.client.start.mockResolvedValue(undefined);
    mocks.client.joinSession.mockResolvedValue(snapshot);
    mocks.client.leaveSession.mockResolvedValue(undefined);
    mocks.client.stop.mockResolvedValue(undefined);
  });

  it('does not create duplicate backend sessions under React Strict Mode', async () => {
    const sessionStart = createDeferred<{ sessionId: string; snapshot: MatchSessionSnapshot }>();
    mocks.createMatchSession.mockReturnValue(sessionStart.promise);

    render(
      <StrictMode>
        <RemoteSessionProbe onGoal={vi.fn()} />
      </StrictMode>,
    );

    expect(mocks.createMatchSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      sessionStart.resolve({ sessionId: 'session-1', snapshot });
      await sessionStart.promise;
    });

    expect(await screen.findByText('connected')).toBeInTheDocument();
    expect(mocks.createMatchSession).toHaveBeenCalledTimes(1);
    expect(mocks.client.start).toHaveBeenCalledTimes(1);
    expect(mocks.client.joinSession).toHaveBeenCalledWith('session-1');
  });

  it('deduplicates processed events across render updates before triggering playback', async () => {
    const user = userEvent.setup();
    const onGoal = vi.fn();
    const goalEvent: MatchSessionEvent = {
      atSecond: 14 * 60,
      awayScore: 0,
      homeScore: 1,
      id: 'demo-2026-summer-cup-001-home-goal-1',
      label: 'North Harbor FC goal',
      teamId: 'north-harbor-fc',
      type: 'goal',
    };
    // eslint-disable-next-line no-unused-vars
    let eventHandler: ((event: MatchSessionEvent) => void) | null = null;
    // eslint-disable-next-line no-unused-vars
    mocks.client.onEventProcessed.mockImplementation((handler: (event: MatchSessionEvent) => void) => {
      eventHandler = handler;
    });
    mocks.createMatchSession.mockResolvedValue({ sessionId: 'session-1', snapshot });

    render(<RemoteSessionProbe onGoal={onGoal} />);

    expect(await screen.findByText('connected')).toBeInTheDocument();

    await act(async () => {
      eventHandler?.(goalEvent);
    });
    await user.click(screen.getByRole('button', { name: 'Force render' }));
    await act(async () => {
      eventHandler?.(goalEvent);
    });

    expect(onGoal).toHaveBeenCalledTimes(1);
  });
});

// eslint-disable-next-line no-unused-vars
function RemoteSessionProbe({ onGoal }: { onGoal: (event: MatchSessionEvent) => void }) {
  const [renderCount, setRenderCount] = useState(0);
  const { status } = useRemoteMatchSession({
    match,
    onNewSupportedTeamGoal: onGoal,
    speed: 'demo',
    supportedTeamId: 'north-harbor-fc',
  });

  return (
    <div>
      <p>{status}</p>
      <p>Renders: {renderCount}</p>
      <button onClick={() => setRenderCount((current) => current + 1)} type="button">
        Force render
      </button>
    </div>
  );
}

function createDeferred<T>() {
  // eslint-disable-next-line no-unused-vars
  let resolve!: (value: T) => void;
  // eslint-disable-next-line no-unused-vars
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}
