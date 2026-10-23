import { apiRequest } from "./httpClient";
import type { LifecycleAction, LifecycleChangeResult } from "../types/machineLifecycle";

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
