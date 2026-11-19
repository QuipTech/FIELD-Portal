import { apiRequest } from "./httpClient";
import { requireAccessToken } from "./requireAccessToken";

export interface MachineControlOrganisation {
  id: string;
  name: string;
  machineControlEnabled: boolean;
  activeMachineCount: number;
  connectedDeviceCount: number;
}

const path = "/admin/machine-control/organisations";
const authorization = () => ({ Authorization: `Bearer ${requireAccessToken()}` });

// Organisations with Machine Control on come first.
export const listMachineControlOrganisationsRequest = (search: string): Promise<MachineControlOrganisation[]> =>
  apiRequest<MachineControlOrganisation[]>(`${path}?${new URLSearchParams(search.trim() ? { search: search.trim() } : {})}`, {
    headers: authorization(),
  });

export const setMachineControlRequest = (tenantId: string, enabled: boolean) =>
  apiRequest<{ id: string; machineControlEnabled: boolean }>(`${path}/${tenantId}`, {
    method: "PATCH",
    headers: authorization(),
    body: JSON.stringify({ enabled }),
  });
