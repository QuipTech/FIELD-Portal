import { apiRequest } from "./httpClient";
import type {
  ActivationQuote,
  BulkLifecycleResult,
  LifecycleAction,
  LifecycleChangeResult,
  MachineLifecycle,
  MachineTransfer,
} from "../types/machineLifecycle";

// Activating, deactivating, archiving or reactivating a machine. Needs the
// machine.lifecycle permission and a billing account on the organisation.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const applyLifecycleActionRequest = (
  accessToken: string,
  machineId: string,
  action: LifecycleAction,
  reason?: string,
): Promise<LifecycleChangeResult> =>
  apiRequest<LifecycleChangeResult>(`/machines/${machineId}/lifecycle`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(reason ? { action, reason } : { action }),
  });

export const getMachineLifecycleRequest = (accessToken: string, machineId: string) =>
  apiRequest<MachineLifecycle>(`/machines/${machineId}/lifecycle`, { headers: authorizationHeader(accessToken) });

// Up to 200 machines at once; each one succeeds or fails on its own.
export const applyBulkLifecycleActionRequest = (
  accessToken: string,
  machineIds: string[],
  action: LifecycleAction,
): Promise<BulkLifecycleResult> =>
  apiRequest<BulkLifecycleResult>("/machines/lifecycle/bulk", {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify({ machineIds, action }),
  });

// Sale to another organisation, which must approve it (its organisation ID is the slug it shares).
export const requestTransferRequest = (
  accessToken: string,
  machineId: string,
  input: { receivingOrganisationSlug: string; reason: string },
) =>
  apiRequest<MachineTransfer>(`/machines/${machineId}/transfers`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(input),
  });

export const listTransfersRequest = (accessToken: string, direction: "incoming" | "outgoing") =>
  apiRequest<MachineTransfer[]>(`/machine-transfers?direction=${direction}`, {
    headers: authorizationHeader(accessToken),
  });

export const decideTransferRequest = (
  accessToken: string,
  transferId: string,
  decision: "approve" | "reject" | "cancel",
  note?: string,
) =>
  apiRequest<MachineTransfer>(`/machine-transfers/${transferId}/${decision}`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(note ? { note } : {}),
  });

export const getChainOfCustodyRequest = (accessToken: string, machineId: string) =>
  apiRequest<MachineTransfer[]>(`/machines/${machineId}/custody`, { headers: authorizationHeader(accessToken) });

// The price shown before activating `count` machines; nothing is charged now.
export const getActivationQuoteRequest = (accessToken: string, count = 1): Promise<ActivationQuote> =>
  apiRequest<ActivationQuote>(`/machines/lifecycle/activation-quote?count=${count}`, {
    headers: authorizationHeader(accessToken),
  });
