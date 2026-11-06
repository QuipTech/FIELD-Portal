import type { MachineAppConnection, PairingCodeResult } from "../types/machineAppConnection";
import { apiRequest } from "./httpClient";
import { requireAccessToken } from "./requireAccessToken";

const connectionPath = (machineId: string) => `/machines/${machineId}/app-connection`;
const authorization = () => ({ Authorization: `Bearer ${requireAccessToken()}` });

export const getMachineAppConnectionRequest = (machineId: string): Promise<MachineAppConnection> =>
  apiRequest<MachineAppConnection>(connectionPath(machineId), { headers: authorization() });

// A new code replaces any earlier one for this machine.
export const createPairingCodeRequest = (machineId: string): Promise<PairingCodeResult> =>
  apiRequest<PairingCodeResult>(`${connectionPath(machineId)}/pairing-code`, { method: "POST", headers: authorization() });

export const disconnectMachineAppRequest = (machineId: string): Promise<void> =>
  apiRequest<void>(connectionPath(machineId), { method: "DELETE", headers: authorization() });
