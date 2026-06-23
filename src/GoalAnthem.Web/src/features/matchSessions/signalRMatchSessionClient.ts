import * as signalR from '@microsoft/signalr';
import { type MatchSessionEvent, type MatchSessionSnapshot } from './matchSessionsApi';

export type MatchSessionSignalRClient = {
  // eslint-disable-next-line no-unused-vars
  joinSession: (sessionId: string) => Promise<MatchSessionSnapshot>;
  // eslint-disable-next-line no-unused-vars
  leaveSession: (sessionId: string) => Promise<void>;
  // eslint-disable-next-line no-unused-vars
  onEventProcessed: (handler: (event: MatchSessionEvent) => void) => void;
  // eslint-disable-next-line no-unused-vars
  onReconnecting: (handler: () => void) => void;
  // eslint-disable-next-line no-unused-vars
  onReconnected: (handler: () => void) => void;
  // eslint-disable-next-line no-unused-vars
  onSessionEnded: (handler: (snapshot: MatchSessionSnapshot) => void) => void;
  // eslint-disable-next-line no-unused-vars
  onSnapshotUpdated: (handler: (snapshot: MatchSessionSnapshot) => void) => void;
  // eslint-disable-next-line no-unused-vars
  onClose: (handler: () => void) => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export function createSignalRMatchSessionClient(): MatchSessionSignalRClient {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${apiBaseUrl}/hubs/matches`)
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .build();

  return {
    joinSession: (sessionId) => connection.invoke<MatchSessionSnapshot>('JoinSession', sessionId),
    leaveSession: (sessionId) => connection.invoke('LeaveSession', sessionId),
    onClose: (handler) => {
      connection.onclose(handler);
    },
    onEventProcessed: (handler) => {
      connection.on('EventProcessed', handler);
    },
    onReconnected: (handler) => {
      connection.onreconnected(handler);
    },
    onReconnecting: (handler) => {
      connection.onreconnecting(handler);
    },
    onSessionEnded: (handler) => {
      connection.on('SessionEnded', handler);
    },
    onSnapshotUpdated: (handler) => {
      connection.on('SnapshotUpdated', handler);
    },
    start: () => connection.start(),
    stop: () => connection.stop(),
  };
}
