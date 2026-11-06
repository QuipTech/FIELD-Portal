export interface MachineAppConnection {
  connected: boolean;
  device: {
    id: string;
    serialNumber: string | null;
    platform: string | null;
    appVersion: string | null;
    pairedAt: string;
  } | null;
}

// connected: the machine already has a tablet, so there's no code.
export interface PairingCodeResult {
  connected: boolean;
  code?: string;
  expiresAt?: string;
}

// "2:05" left on a code; never below zero.
export const formatCodeTimeLeft = (expiresAt: string, now: number): string => {
  const secondsLeft = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  return `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
};

// "123 456", easier to read across to a tablet.
export const formatPairingCode = (code: string): string => `${code.slice(0, 3)} ${code.slice(3)}`;

export const machineAppPagePath = (machineId: string): string => `/machines/${machineId}/machine-app`;
