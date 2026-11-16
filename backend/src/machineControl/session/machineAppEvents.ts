// The Postgres channel migration 0128 announces session changes on.
export const MC_DEVICE_PG_CHANNEL = 'mc_device_event';

// Socket events on /machine-app. The names match migration 0128.
export const MACHINE_APP_EVENTS = {
  sessionStarted: 'session:started',
  sessionStatus: 'session:status',
  sessionEnded: 'session:ended',
} as const;

export type MachineAppEventName =
  (typeof MACHINE_APP_EVENTS)[keyof typeof MACHINE_APP_EVENTS];

export type SessionEndReason =
  | 'portal_disconnected'
  | 'tablet_disconnected'
  | 'replaced'
  | 'connection_timeout';

// active: tablet and at least one portal viewer connected; pending: one is missing.
export type SessionStatus = 'active' | 'pending';

export interface SessionState {
  status: SessionStatus;
  tabletOnline: boolean;
  portalOnline: boolean;
}

export interface MachineAppEvent extends Partial<SessionState> {
  event: MachineAppEventName;
  deviceId: string;
  machineId: string;
  reason: SessionEndReason | null;
}

// The connect_error a tablet gets, and the REST error code, for a token that
// no longer works: the tablet clears its saved pairing.
export const DEVICE_TOKEN_REVOKED = 'DEVICE_TOKEN_REVOKED';

// The tablet's own room, and the portal people watching one machine.
export const deviceRoom = (deviceId: string) => `mc-device:${deviceId}`;
export const machineWatchRoom = (machineId: string) => `mc-watch:${machineId}`;
