import { apiRequest } from "./httpClient";
import type { MachineShare } from "../types/machineGroup";

// Machine detail → Sharing, for the owning organisation's admins.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const listMachineSharesRequest = (accessToken: string, machineId: string) =>
  apiRequest<MachineShare[]>(`/machines/${machineId}/shares`, { headers: authorizationHeader(accessToken) });

// Withdraws only this machine from that share; the platform administrator
// is told. Returns the shares as they are now.
export const withdrawMachineShareRequest = (
  accessToken: string,
  target: { machineId: string; assignmentId: string },
  reason: string,
) =>
  apiRequest<MachineShare[]>(`/machines/${target.machineId}/shares/${target.assignmentId}`, {
    method: "DELETE",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify({ reason }),
  });
