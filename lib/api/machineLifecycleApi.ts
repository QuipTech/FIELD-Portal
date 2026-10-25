import { apiRequest } from "./httpClient";
import type { ActivationQuote, LifecycleAction, LifecycleChangeResult } from "../types/machineLifecycle";

// Activating, deactivating, archiving or reactivating a machine. Needs the
// machine.lifecycle permission and a billing account on the organisation.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const applyLifecycleActionRequest = (
  accessToken: string,
  machineId: string,
  action: LifecycleAction,
): Promise<LifecycleChangeResult> =>
  apiRequest<LifecycleChangeResult>(`/machines/${machineId}/lifecycle`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify({ action }),
  });

// The price shown before activating `count` machines; nothing is charged now.
export const getActivationQuoteRequest = (accessToken: string, count = 1): Promise<ActivationQuote> =>
  apiRequest<ActivationQuote>(`/machines/lifecycle/activation-quote?count=${count}`, {
    headers: authorizationHeader(accessToken),
  });
