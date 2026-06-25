import { useEffect, useRef, useState } from 'react';
import { type DemoMatch } from '../matches/demoMatchesApi';
import { type MatchSpeed } from '../matchMode/matchSimulation';
import { createMatchSession, endMatchSession, type MatchSessionEvent, type MatchSessionSnapshot } from './matchSessionsApi';
import { createSignalRMatchSessionClient } from './signalRMatchSessionClient';

export type RemoteMatchSessionStatus =
  | 'starting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'unavailable'
  | 'ended';

type RemoteSessionStart = {
  promise: Promise<{ sessionId: string; snapshot: MatchSessionSnapshot }>;
  release: () => void;
};

const pendingSessionStarts = new Map<
  string,
  {
    consumers: number;
    promise: Promise<{ sessionId: string; snapshot: MatchSessionSnapshot }>;
    settled: boolean;
  }
>();

export function useRemoteMatchSession({
  match,
  onNewSupportedTeamGoal,
  speed,
  supportedTeamId,
}: {
  match: DemoMatch;
  // eslint-disable-next-line no-unused-vars
  onNewSupportedTeamGoal: (event: MatchSessionEvent) => void;
  speed: MatchSpeed;
  supportedTeamId: string;
}) {
  const [status, setStatus] = useState<RemoteMatchSessionStatus>('starting');
  const [snapshot, setSnapshot] = useState<MatchSessionSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<ReturnType<typeof createSignalRMatchSessionClient> | null>(null);
  const handledEventIdsRef = useRef(new Set<string>());
  const hydratedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<RemoteSessionStart | null>(null);

  useEffect(() => {
    let isActive = true;

    async function start() {
      try {
        setStatus('starting');
        const sessionStart = acquireRemoteSessionStart({
          match,
          speed,
          supportedTeamId,
        });
        sessionStartRef.current = sessionStart;
        const created = await sessionStart.promise;

        if (!isActive) {
          return;
        }

        sessionIdRef.current = created.sessionId;
        hydrateSnapshot(created.snapshot);
        setStatus('connecting');

        const client = createSignalRMatchSessionClient();
        clientRef.current = client;
        client.onSnapshotUpdated(handleSnapshot);
        client.onEventProcessed(handleEvent);
        client.onSessionEnded((endedSnapshot) => {
          hydrateSnapshot(endedSnapshot);
          setStatus('ended');
        });
        client.onReconnecting(() => setStatus('reconnecting'));
        client.onReconnected(() => {
          setStatus('connected');
          const sessionId = sessionIdRef.current;
          if (sessionId) {
            void client.joinSession(sessionId).then(handleSnapshot).catch(() => setStatus('unavailable'));
          }
        });
        client.onClose(() => setStatus((current) => (current === 'ended' ? current : 'disconnected')));

        await client.start();
        await client.joinSession(created.sessionId);

        if (isActive) {
          setStatus('connected');
        }
      } catch (startError) {
        if (isActive) {
          setError(startError instanceof Error ? startError.message : 'Remote match session is unavailable.');
          setStatus('unavailable');
        }
      }
    }

    function hydrateSnapshot(nextSnapshot: MatchSessionSnapshot) {
      setSnapshot(nextSnapshot);
      if (!hydratedRef.current) {
        for (const event of nextSnapshot.timeline) {
          handledEventIdsRef.current.add(event.id);
        }
        hydratedRef.current = true;
        return;
      }

      for (const event of nextSnapshot.timeline) {
        handleEvent(event);
      }
    }

    function handleSnapshot(nextSnapshot: MatchSessionSnapshot) {
      hydrateSnapshot(nextSnapshot);
    }

    function handleEvent(event: MatchSessionEvent) {
      if (handledEventIdsRef.current.has(event.id)) {
        return;
      }

      handledEventIdsRef.current.add(event.id);
      setSnapshot((current) =>
        current
          ? {
              ...current,
              awayScore: event.awayScore,
              homeScore: event.homeScore,
              timeline: current.timeline.some((item) => item.id === event.id) ? current.timeline : [...current.timeline, event],
            }
          : current,
      );

      if (event.type === 'goal' && event.teamId === supportedTeamId) {
        onNewSupportedTeamGoal(event);
      }
    }

    void start();

    return () => {
      isActive = false;
      const client = clientRef.current;
      const sessionId = sessionIdRef.current;
      const sessionStart = sessionStartRef.current;
      clientRef.current = null;
      sessionStartRef.current = null;
      sessionStart?.release();
      if (client && sessionId) {
        void client.leaveSession(sessionId).finally(() => void client.stop());
      } else if (client) {
        void client.stop();
      }
    };
  }, [match, onNewSupportedTeamGoal, speed, supportedTeamId]);

  async function endSession() {
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      setStatus('ended');
      return;
    }

    const endedSnapshot = await endMatchSession(sessionId);
    setSnapshot(endedSnapshot);
    setStatus('ended');
  }

  return { endSession, error, snapshot, status };
}

function acquireRemoteSessionStart({
  match,
  speed,
  supportedTeamId,
}: {
  match: DemoMatch;
  speed: MatchSpeed;
  supportedTeamId: string;
}): RemoteSessionStart {
  const key = `${match.id}:${supportedTeamId}:${speed}`;
  let entry = pendingSessionStarts.get(key);

  if (entry?.settled && entry.consumers === 0) {
    pendingSessionStarts.delete(key);
    entry = undefined;
  }

  if (!entry) {
    const nextEntry: {
      consumers: number;
      promise: Promise<{ sessionId: string; snapshot: MatchSessionSnapshot }>;
      settled: boolean;
    } = {
      consumers: 0,
      promise: undefined as unknown as Promise<{ sessionId: string; snapshot: MatchSessionSnapshot }>,
      settled: false,
    };
    nextEntry.promise = createMatchSession({
      match,
      speed,
      supportedTeamId,
    }).finally(() => {
      nextEntry.settled = true;
      queueMicrotask(() => {
        const current = pendingSessionStarts.get(key);
        if (current && current.consumers === 0) {
          pendingSessionStarts.delete(key);
        }
      });
    });
    entry = nextEntry;
    pendingSessionStarts.set(key, entry);
  }

  entry.consumers += 1;

  return {
    promise: entry.promise,
    release: () => {
      const current = pendingSessionStarts.get(key);
      if (!current) {
        return;
      }

      current.consumers = Math.max(0, current.consumers - 1);
      if (current.consumers === 0) {
        queueMicrotask(() => {
          const latest = pendingSessionStarts.get(key);
          if (latest && latest.consumers === 0) {
            pendingSessionStarts.delete(key);
          }
        });
      }
    },
  };
}
