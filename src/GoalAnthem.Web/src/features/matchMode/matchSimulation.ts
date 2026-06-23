import { type DemoMatch, type Team } from '../matches/demoMatchesApi';

export type MatchSpeed = 'normal' | 'demo';

export type MatchEvent =
  | {
      id: string;
      atSecond: number;
      type: 'kickoff' | 'half-time' | 'second-half' | 'full-time';
      label: string;
    }
  | {
      id: string;
      atSecond: number;
      type: 'goal';
      teamId: Team['id'];
      label: string;
    };

export type ProcessedMatchEvent = MatchEvent & {
  homeScore: number;
  awayScore: number;
};

export type MatchSnapshot = {
  elapsedSeconds: number;
  homeScore: number;
  awayScore: number;
  status: 'waiting' | 'live' | 'half-time' | 'ended';
  timeline: ProcessedMatchEvent[];
};

export type MatchScheduler = {
  // eslint-disable-next-line no-unused-vars
  setInterval(callback: () => void, delayMs: number): number;
  // eslint-disable-next-line no-unused-vars
  clearInterval(timerId: number): void;
};

type MatchEngineOptions = {
  events: readonly MatchEvent[];
  match: DemoMatch;
  scheduler: MatchScheduler;
  speed: MatchSpeed;
  supportedTeamId: Team['id'];
  // eslint-disable-next-line no-unused-vars
  onGoalForSupportedTeam: (event: ProcessedMatchEvent) => void;
  // eslint-disable-next-line no-unused-vars
  onSnapshot: (snapshot: MatchSnapshot) => void;
};

const speedSecondsPerTick: Record<MatchSpeed, number> = {
  normal: 1,
  demo: 15,
};

export function getDemoMatchEvents(match: DemoMatch): readonly MatchEvent[] {
  return [
    {
      id: `${match.id}-kickoff`,
      atSecond: 0,
      type: 'kickoff',
      label: 'Kickoff',
    },
    {
      id: `${match.id}-home-goal-1`,
      atSecond: 14,
      type: 'goal',
      teamId: match.homeTeam.id,
      label: `${match.homeTeam.name} goal`,
    },
    {
      id: `${match.id}-half-time`,
      atSecond: 45,
      type: 'half-time',
      label: 'Half-time',
    },
    {
      id: `${match.id}-second-half`,
      atSecond: 50,
      type: 'second-half',
      label: 'Second half',
    },
    {
      id: `${match.id}-away-goal-1`,
      atSecond: 66,
      type: 'goal',
      teamId: match.awayTeam.id,
      label: `${match.awayTeam.name} goal`,
    },
    {
      id: `${match.id}-home-goal-2`,
      atSecond: 82,
      type: 'goal',
      teamId: match.homeTeam.id,
      label: `${match.homeTeam.name} goal`,
    },
    {
      id: `${match.id}-full-time`,
      atSecond: 90,
      type: 'full-time',
      label: 'Full-time',
    },
  ];
}

export function createInitialMatchSnapshot(): MatchSnapshot {
  return {
    elapsedSeconds: 0,
    homeScore: 0,
    awayScore: 0,
    status: 'waiting',
    timeline: [],
  };
}

export function createBrowserScheduler(): MatchScheduler {
  return {
    setInterval: (callback, delayMs) => window.setInterval(callback, delayMs),
    clearInterval: (timerId) => window.clearInterval(timerId),
  };
}

export function formatMatchClock(elapsedSeconds: number) {
  const minute = Math.max(0, Math.floor(elapsedSeconds));

  return `${minute}'`;
}

export class MatchSimulationEngine {
  private elapsedSeconds = 0;
  private homeScore = 0;
  private awayScore = 0;
  private processedEventIds = new Set<string>();
  private status: MatchSnapshot['status'] = 'waiting';
  private timerId: number | null = null;
  private timeline: ProcessedMatchEvent[] = [];
  private readonly events: readonly MatchEvent[];
  private readonly match: DemoMatch;
  private readonly scheduler: MatchScheduler;
  private readonly secondsPerTick: number;
  private readonly supportedTeamId: Team['id'];
  // eslint-disable-next-line no-unused-vars
  private readonly onGoalForSupportedTeam: (event: ProcessedMatchEvent) => void;
  // eslint-disable-next-line no-unused-vars
  private readonly onSnapshot: (snapshot: MatchSnapshot) => void;

  constructor(options: MatchEngineOptions) {
    this.events = [...options.events].sort((first, second) => first.atSecond - second.atSecond);
    this.match = options.match;
    this.scheduler = options.scheduler;
    this.secondsPerTick = speedSecondsPerTick[options.speed];
    this.supportedTeamId = options.supportedTeamId;
    this.onGoalForSupportedTeam = options.onGoalForSupportedTeam;
    this.onSnapshot = options.onSnapshot;
  }

  start() {
    if (this.timerId !== null) {
      return;
    }

    this.status = 'live';
    this.processDueEvents();
    this.publish();
    this.timerId = this.scheduler.setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.timerId === null) {
      return;
    }

    this.scheduler.clearInterval(this.timerId);
    this.timerId = null;
  }

  private tick() {
    if (this.status === 'ended') {
      this.stop();
      return;
    }

    this.elapsedSeconds += this.secondsPerTick;
    this.processDueEvents();
    this.publish();
  }

  private processDueEvents() {
    for (const event of this.events) {
      if (event.atSecond > this.elapsedSeconds || this.processedEventIds.has(event.id)) {
        continue;
      }

      this.processedEventIds.add(event.id);
      const processedEvent = this.applyEvent(event);
      this.timeline = [...this.timeline, processedEvent];

      if (processedEvent.type === 'goal' && processedEvent.teamId === this.supportedTeamId) {
        this.onGoalForSupportedTeam(processedEvent);
      }
    }
  }

  private applyEvent(event: MatchEvent): ProcessedMatchEvent {
    if (event.type === 'goal') {
      if (event.teamId === this.match.homeTeam.id) {
        this.homeScore += 1;
      }

      if (event.teamId === this.match.awayTeam.id) {
        this.awayScore += 1;
      }
    }

    if (event.type === 'half-time') {
      this.status = 'half-time';
    }

    if (event.type === 'second-half') {
      this.status = 'live';
    }

    if (event.type === 'full-time') {
      this.status = 'ended';
      this.stop();
    }

    return {
      ...event,
      homeScore: this.homeScore,
      awayScore: this.awayScore,
    };
  }

  private publish() {
    this.onSnapshot({
      elapsedSeconds: this.elapsedSeconds,
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      status: this.status,
      timeline: this.timeline,
    });
  }
}
