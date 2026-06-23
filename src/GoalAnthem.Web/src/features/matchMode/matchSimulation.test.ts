import { describe, expect, it, vi } from 'vitest';
import { type DemoMatch } from '../matches/demoMatchesApi';
import { type MatchEvent, MatchSimulationEngine, type MatchScheduler, formatMatchClock, getDemoMatchEvents } from './matchSimulation';

const match: DemoMatch = {
  id: 'demo-2026-summer-cup-001',
  kickoffTime: '2026-07-04T18:00:00+02:00',
  status: 'playable',
  homeTeam: { id: 'north-harbor-fc', name: 'North Harbor FC' },
  awayTeam: { id: 'eastgate-city', name: 'Eastgate City' },
};

describe('MatchSimulationEngine', () => {
  it('formats football match seconds as minutes', () => {
    expect(formatMatchClock(0)).toBe("0'");
    expect(formatMatchClock(59)).toBe("0'");
    expect(formatMatchClock(60)).toBe("1'");
    expect(formatMatchClock(14 * 60)).toBe("14'");
    expect(formatMatchClock(90 * 60)).toBe("90'");
  });

  it('advances one match second per real second on normal speed', () => {
    const scheduler = createManualScheduler();
    const onGoalForSupportedTeam = vi.fn();
    const onSnapshot = vi.fn();

    const engine = new MatchSimulationEngine({
      events: [
        {
          id: 'kickoff',
          atSecond: 0,
          type: 'kickoff',
          label: 'Kickoff',
        },
        {
          id: 'home-goal',
          atSecond: 60,
          type: 'goal',
          teamId: match.homeTeam.id,
          label: 'Home goal',
        },
      ],
      match,
      scheduler,
      speed: 'normal',
      supportedTeamId: match.homeTeam.id,
      onGoalForSupportedTeam,
      onSnapshot,
    });

    engine.start();
    scheduler.runTicks(59);

    expect(onSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        elapsedSeconds: 59,
        homeScore: 0,
        awayScore: 0,
      }),
    );

    scheduler.runTicks(1);

    expect(onSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        elapsedSeconds: 60,
        homeScore: 1,
        awayScore: 0,
        timeline: [
          expect.objectContaining({ id: 'kickoff', type: 'kickoff' }),
          expect.objectContaining({ id: 'home-goal', type: 'goal' }),
        ],
      }),
    );
    expect(onGoalForSupportedTeam).toHaveBeenCalledTimes(1);
  });

  it('advances fifteen match seconds per real second on demo speed', () => {
    const scheduler = createManualScheduler();
    const onSnapshot = vi.fn();

    const engine = new MatchSimulationEngine({
      events: [],
      match,
      scheduler,
      speed: 'demo',
      supportedTeamId: match.homeTeam.id,
      onGoalForSupportedTeam: vi.fn(),
      onSnapshot,
    });

    engine.start();
    scheduler.runTicks(1);

    expect(onSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ elapsedSeconds: 15 }));
  });

  it('processes ordered demo events, including half-time and full-time at real match seconds', () => {
    const scheduler = createManualScheduler();
    const onGoalForSupportedTeam = vi.fn();
    const onSnapshot = vi.fn();

    const engine = new MatchSimulationEngine({
      events: getDemoMatchEvents(match),
      match,
      scheduler,
      speed: 'demo',
      supportedTeamId: match.homeTeam.id,
      onGoalForSupportedTeam,
      onSnapshot,
    });

    engine.start();

    scheduler.runTicks(180);

    expect(onSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        elapsedSeconds: 2700,
        homeScore: 1,
        awayScore: 0,
        status: 'half-time',
        timeline: [
          expect.objectContaining({ id: `${match.id}-kickoff`, atSecond: 0 }),
          expect.objectContaining({ id: `${match.id}-home-goal-1`, atSecond: 14 * 60 }),
          expect.objectContaining({ id: `${match.id}-half-time`, atSecond: 45 * 60 }),
        ],
      }),
    );

    scheduler.runTicks(4);

    expect(onSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        elapsedSeconds: 2760,
        status: 'live',
        timeline: expect.arrayContaining([expect.objectContaining({ id: `${match.id}-second-half`, atSecond: 46 * 60 })]),
      }),
    );

    scheduler.runTicks(176);

    expect(onSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        elapsedSeconds: 90 * 60,
        homeScore: 2,
        awayScore: 1,
        status: 'ended',
        timeline: expect.arrayContaining([
          expect.objectContaining({ id: `${match.id}-away-goal-1`, atSecond: 66 * 60 }),
          expect.objectContaining({ id: `${match.id}-home-goal-2`, atSecond: 82 * 60 }),
          expect.objectContaining({ id: `${match.id}-full-time`, atSecond: 90 * 60 }),
        ]),
      }),
    );

    expect(onGoalForSupportedTeam).toHaveBeenCalledTimes(2);
  });

  it('triggers playback only for supported-team goals and ignores duplicate IDs', () => {
    const scheduler = createManualScheduler();
    const onGoalForSupportedTeam = vi.fn();
    const duplicateGoal: MatchEvent = {
      id: 'stable-goal-id',
      atSecond: 60,
      type: 'goal',
      teamId: match.homeTeam.id,
      label: 'Home goal',
    };

    const engine = new MatchSimulationEngine({
      events: [
        {
          id: 'kickoff',
          atSecond: 0,
          type: 'kickoff',
          label: 'Kickoff',
        },
        duplicateGoal,
        { ...duplicateGoal },
        { id: 'opponent-goal', atSecond: 120, type: 'goal', teamId: match.awayTeam.id, label: 'Away goal' },
      ],
      match,
      scheduler,
      speed: 'normal',
      supportedTeamId: match.homeTeam.id,
      onGoalForSupportedTeam,
      onSnapshot: vi.fn(),
    });

    engine.start();
    scheduler.runTicks(120);

    expect(onGoalForSupportedTeam).toHaveBeenCalledTimes(1);
    expect(onGoalForSupportedTeam).toHaveBeenCalledWith(expect.objectContaining({ id: 'stable-goal-id' }));
  });

  it('cleans up timers when stopped', () => {
    const scheduler = createManualScheduler();
    const engine = new MatchSimulationEngine({
      events: [],
      match,
      scheduler,
      speed: 'normal',
      supportedTeamId: match.homeTeam.id,
      onGoalForSupportedTeam: vi.fn(),
      onSnapshot: vi.fn(),
    });

    engine.start();
    engine.stop();

    expect(scheduler.clearIntervalMock).toHaveBeenCalledWith(1);
    expect(scheduler.activeTimerCount()).toBe(0);
  });
});

function createManualScheduler() {
  const callbacks = new Map<number, () => void>();
  let nextTimerId = 1;
  const setIntervalMock = vi.fn();
  const clearIntervalMock = vi.fn((timerId: number) => {
    callbacks.delete(timerId);
  });

  const scheduler: MatchScheduler & {
    activeTimerCount: () => number;
    // eslint-disable-next-line no-unused-vars
    runTicks: (count: number) => void;
    setIntervalMock: ReturnType<typeof vi.fn>;
    clearIntervalMock: ReturnType<typeof vi.fn>;
  } = {
    setInterval: ((callback: Parameters<MatchScheduler['setInterval']>[0]) => {
      setIntervalMock(callback);
      const timerId = nextTimerId;
      nextTimerId += 1;
      callbacks.set(timerId, callback as () => void);

      return timerId;
    }) as MatchScheduler['setInterval'],
    clearInterval: ((timerId: number) => {
      clearIntervalMock(timerId);
    }) as MatchScheduler['clearInterval'],
    activeTimerCount: () => callbacks.size,
    runTicks: (count: number) => {
      for (let index = 0; index < count; index += 1) {
        const callback = callbacks.values().next().value;

        if (callback) {
          callback();
        }
      }
    },
    setIntervalMock,
    clearIntervalMock,
  };

  return scheduler;
}
