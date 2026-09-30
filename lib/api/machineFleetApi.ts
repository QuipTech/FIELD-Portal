import { apiRequest } from "./httpClient";
import type {
  FleetMachine,
  MachineCatalogMake,
  MachineFleetFilters,
  MachineFleetList,
  NewMachine,
} from "../types/machineFleet";

const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

const toQueryString = (filters: MachineFleetFilters, search: string): string => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
  if (search.trim()) params.set("search", search.trim());
  return params.toString();
};

export const listMachinesRequest = (accessToken: string, filters: MachineFleetFilters, search: string) =>
  apiRequest<MachineFleetList>(`/machines?${toQueryString(filters, search)}`, {
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
