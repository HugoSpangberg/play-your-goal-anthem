import { describe, expect, it, vi } from 'vitest';
import { type DemoMatch } from '../matches/demoMatchesApi';
import { type MatchEvent, MatchSimulationEngine, type MatchScheduler, getDemoMatchEvents } from './matchSimulation';

const match: DemoMatch = {
  id: 'demo-2026-summer-cup-001',
  kickoffTime: '2026-07-04T18:00:00+02:00',
  status: 'playable',
  homeTeam: { id: 'north-harbor-fc', name: 'North Harbor FC' },
  awayTeam: { id: 'eastgate-city', name: 'Eastgate City' },
};

describe('MatchSimulationEngine', () => {
  it('uses kickoff as the first synchronized event', () => {
    const scheduler = createManualScheduler();
    const onSnapshot = vi.fn();

    const engine = new MatchSimulationEngine({
      events: getDemoMatchEvents(match),
      match,
      scheduler,
      speed: 'normal',
      supportedTeamId: match.homeTeam.id,
      onGoalForSupportedTeam: vi.fn(),
      onSnapshot,
    });

    engine.start();

    expect(onSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        elapsedSeconds: 0,
        status: 'live',
        timeline: [expect.objectContaining({ id: `${match.id}-kickoff`, type: 'kickoff' })],
      }),
    );
  });

  it('processes events in order and updates clock and score', () => {
    const scheduler = createManualScheduler();
    const onSnapshot = vi.fn();

    const engine = new MatchSimulationEngine({
      events: [
        { id: 'second', atSecond: 2, type: 'goal', teamId: match.awayTeam.id, label: 'Away goal' },
        { id: 'first', atSecond: 1, type: 'goal', teamId: match.homeTeam.id, label: 'Home goal' },
      ],
      match,
      scheduler,
      speed: 'normal',
      supportedTeamId: match.homeTeam.id,
      onGoalForSupportedTeam: vi.fn(),
      onSnapshot,
    });

    engine.start();
    scheduler.runNext();
    scheduler.runNext();

    expect(onSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        elapsedSeconds: 2,
        homeScore: 1,
        awayScore: 1,
        timeline: [
          expect.objectContaining({ id: 'first', homeScore: 1, awayScore: 0 }),
          expect.objectContaining({ id: 'second', homeScore: 1, awayScore: 1 }),
        ],
      }),
    );
  });

  it('triggers playback only for supported-team goals and ignores duplicate IDs', () => {
    const scheduler = createManualScheduler();
    const onGoalForSupportedTeam = vi.fn();
    const duplicateGoal: MatchEvent = {
      id: 'stable-goal-id',
      atSecond: 1,
      type: 'goal',
      teamId: match.homeTeam.id,
      label: 'Home goal',
    };

    const engine = new MatchSimulationEngine({
      events: [
        duplicateGoal,
        { ...duplicateGoal, atSecond: 1 },
        { id: 'opponent-goal', atSecond: 2, type: 'goal', teamId: match.awayTeam.id, label: 'Away goal' },
      ],
      match,
      scheduler,
      speed: 'normal',
      supportedTeamId: match.homeTeam.id,
      onGoalForSupportedTeam,
      onSnapshot: vi.fn(),
    });

    engine.start();
    scheduler.runNext();
    scheduler.runNext();

    expect(onGoalForSupportedTeam).toHaveBeenCalledTimes(1);
    expect(onGoalForSupportedTeam).toHaveBeenCalledWith(expect.objectContaining({ id: 'stable-goal-id' }));
  });

  it('uses faster match-clock ticks in demo speed', () => {
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
    scheduler.runNext();

    expect(onSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ elapsedSeconds: 15 }));
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

    expect(scheduler.clearInterval).toHaveBeenCalledWith(1);
    expect(scheduler.activeTimerCount()).toBe(0);
  });
});

function createManualScheduler() {
  const callbacks = new Map<number, () => void>();
  let nextTimerId = 1;

  const scheduler: MatchScheduler & {
    activeTimerCount: () => number;
    runNext: () => void;
  } = {
    setInterval: vi.fn((callback: () => void) => {
      const timerId = nextTimerId;
      nextTimerId += 1;
      callbacks.set(timerId, callback);

      return timerId;
    }),
    clearInterval: vi.fn((timerId: number) => {
      callbacks.delete(timerId);
    }),
    activeTimerCount: () => callbacks.size,
    runNext: () => {
      const callback = callbacks.values().next().value;

      if (callback) {
        callback();
      }
    },
  };

  return scheduler;
}
