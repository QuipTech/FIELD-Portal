import { apiRequest } from "./httpClient";
import type {
  FleetMachine,
  MachineCatalogMake,
  MachineDetailsChanges,
  MachineFleetFilters,
  MachineFleetList,
  NewMachine,
  OperatingStatus,
} from "../types/machineFleet";

const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const EMPTY_MACHINE_FILTERS: MachineFleetFilters = {
  site: "",
  make: "",
  status: "",
  machineClass: "",
  group: "",
  source: "",
};

export const MACHINES_PAGE_SIZE = 25;

const toQueryString = (filters: MachineFleetFilters, search: string, page: number): string => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(MACHINES_PAGE_SIZE) });
  const { group, ...otherFilters } = filters;
  Object.entries(otherFilters).forEach(([key, value]) => value && params.set(key, value));
  if (group) params.set("groupId", group);
  if (search.trim()) params.set("search", search.trim());
  return params.toString();
};

export const listMachinesRequest = (accessToken: string, filters: MachineFleetFilters, search: string, page = 1) =>
  apiRequest<MachineFleetList>(`/machines?${toQueryString(filters, search, page)}`, {
    headers: authorizationHeader(accessToken),
  });

// Makes and models from the Machine library (needs machine.create).
export const getMachineCatalogRequest = (accessToken: string) =>
  apiRequest<MachineCatalogMake[]>("/machine-catalog", { headers: authorizationHeader(accessToken) });

// 409 when the serial is already registered in the organisation.
export const registerMachineRequest = (accessToken: string, machine: NewMachine) =>
  apiRequest<FleetMachine>("/machines", {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(machine),
  });

// Needs machine.manage; own organisation's machines only.
export const updateMachineDetailsRequest = (accessToken: string, machineId: string, changes: MachineDetailsChanges) =>
  apiRequest<FleetMachine>(`/machines/${machineId}`, {
    method: "PATCH",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(changes),
  });

// Needs machine.manage. Plant ID (assetNumber; null clears it) and serial
// corrections, audited with the reason. 409 if another machine in the
// organisation already has the serial.
export const correctMachineIdentifiersRequest = (
  accessToken: string,
  machineId: string,
  changes: { serialNumber?: string; assetNumber?: string | null; reason: string },
) =>
  apiRequest<unknown>(`/machines/${machineId}/identifiers`, {
    method: "PATCH",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(changes),
  });

// Needs machine.manage. Each change feeds the dashboard's fleet uptime.
export const updateMachineStatusRequest = (accessToken: string, machineId: string, status: OperatingStatus) =>
  apiRequest<FleetMachine>(`/machines/${machineId}/status`, {
    method: "PATCH",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify({ status }),
  });
