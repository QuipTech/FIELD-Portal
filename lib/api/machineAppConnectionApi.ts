import type { MachineAppConnection } from "../types/machineAppConnection";
import { apiRequest } from "./httpClient";
import { requireAccessToken } from "./requireAccessToken";

const connectionPath = (machineId: string) => `/machines/${machineId}/app-connection`;
const authorization = () => ({ Authorization: `Bearer ${requireAccessToken()}` });

export const getMachineAppConnectionRequest = (machineId: string): Promise<MachineAppConnection> =>
  apiRequest<MachineAppConnection>(connectionPath(machineId), { headers: authorization(), cache: "no-store" });

// Adds the tablet with this FIELD ID and password to the machine.
export const addTabletRequest = (machineId: string, fieldId: string, password: string): Promise<void> =>
  apiRequest<void>(`${connectionPath(machineId)}/tablet`, {
    method: "POST",
    headers: authorization(),
    body: JSON.stringify({ fieldId, password }),
  });

export const resetTabletPasswordRequest = (machineId: string, password: string): Promise<void> =>
  apiRequest<void>(`${connectionPath(machineId)}/tablet/password`, {
    method: "PUT",
    headers: authorization(),
    body: JSON.stringify({ password }),
  });

export const disconnectMachineAppRequest = (machineId: string): Promise<void> =>
  apiRequest<void>(connectionPath(machineId), { method: "DELETE", headers: authorization() });
