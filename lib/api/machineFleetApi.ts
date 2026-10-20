import { apiRequest } from "./httpClient";
import type {
  FleetMachine,
  MachineCatalogMake,
  MachineFleetFilters,
  MachineFleetList,
  NewMachine,
  OperatingStatus,
} from "../types/machineFleet";

const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const EMPTY_MACHINE_FILTERS: MachineFleetFilters = { site: "", make: "", status: "", machineClass: "" };

export const MACHINES_PAGE_SIZE = 25;

const toQueryString = (filters: MachineFleetFilters, search: string, page: number): string => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(MACHINES_PAGE_SIZE) });
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
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

// Needs machine.manage. Each change feeds the dashboard's fleet uptime.
export const updateMachineStatusRequest = (accessToken: string, machineId: string, status: OperatingStatus) =>
  apiRequest<FleetMachine>(`/machines/${machineId}/status`, {
    method: "PATCH",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify({ status }),
  });
