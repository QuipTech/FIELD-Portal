import { apiRequest } from "./httpClient";
import type {
  CreateMachineModelPayload,
  ImportModelTreePayload,
  MachineModelSummary,
  ModelSystemTree,
} from "../types/machineLibrary";

// The shared machine library every organisation's machines are built
// from. Owner role only. Every tree change responds with the refreshed tree.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

const sendTreeChange = (accessToken: string, path: string, method: string, body?: unknown) =>
  apiRequest<ModelSystemTree>(path, {
    method,
    headers: authorizationHeader(accessToken),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const listMachineModelsRequest = (accessToken: string, search: string): Promise<MachineModelSummary[]> => {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiRequest<MachineModelSummary[]>(`/admin/machineModels${query}`, {
    headers: authorizationHeader(accessToken),
  });
};

export const createMachineModelRequest = (
  accessToken: string,
  payload: CreateMachineModelPayload,
): Promise<MachineModelSummary> =>
  apiRequest<MachineModelSummary>("/admin/machineModels", {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(payload),
  });

// Refused (409) while machines still use the model.
export const deleteMachineModelRequest = (accessToken: string, modelId: string): Promise<void> =>
  apiRequest<void>(`/admin/machineModels/${modelId}`, { method: "DELETE", headers: authorizationHeader(accessToken) });

export const getModelTreeRequest =(accessToken: string, modelId: string): Promise<ModelSystemTree> =>
  apiRequest<ModelSystemTree>(`/admin/machineModels/${modelId}/tree`, { headers: authorizationHeader(accessToken) });

export const addModelSystemRequest = (accessToken: string, modelId: string, name: string) =>
  sendTreeChange(accessToken, `/admin/machineModels/${modelId}/systems`, "POST", { name });

export const importModelTreeRequest = (accessToken: string, modelId: string, payload: ImportModelTreePayload) =>
  sendTreeChange(accessToken, `/admin/machineModels/${modelId}/tree/import`, "POST", payload);

export const renameModelSystemRequest = (accessToken: string, systemId: string, name: string) =>
  sendTreeChange(accessToken, `/admin/modelSystems/${systemId}`, "PATCH", { name });

// Also removes the system's components.
export const deleteModelSystemRequest = (accessToken: string, systemId: string) =>
  sendTreeChange(accessToken, `/admin/modelSystems/${systemId}`, "DELETE");

export const addModelComponentRequest = (accessToken: string, systemId: string, name: string) =>
  sendTreeChange(accessToken, `/admin/modelSystems/${systemId}/components`, "POST", { name });

export const renameModelComponentRequest = (accessToken: string, componentId: string, name: string) =>
  sendTreeChange(accessToken, `/admin/modelComponents/${componentId}`, "PATCH", { name });

export const deleteModelComponentRequest = (accessToken: string, componentId: string) =>
  sendTreeChange(accessToken, `/admin/modelComponents/${componentId}`, "DELETE");
