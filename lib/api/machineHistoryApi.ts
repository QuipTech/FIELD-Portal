import { apiRequest } from "./httpClient";
import { uploadMultipart } from "./multipartUpload";
import type {
  LiveHistoryEntry,
  LiveHistoryEntryType,
  MachinePhotoUploadResponse,
  MachineSummary,
} from "../types/machineHistory";

// A machine's technical history and photos, within the caller's organisation.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const getMachineRequest = (accessToken: string, machineId: string): Promise<MachineSummary> =>
  apiRequest<MachineSummary>(`/machines/${machineId}`, { headers: authorizationHeader(accessToken) });

export const listMachineHistoryRequest = (accessToken: string, machineId: string): Promise<LiveHistoryEntry[]> =>
  apiRequest<LiveHistoryEntry[]>(`/machines/${machineId}/history`, { headers: authorizationHeader(accessToken) });

export const createHistoryEntryRequest = (
  accessToken: string,
  machineId: string,
  entry: { entryType: LiveHistoryEntryType; description: string },
): Promise<LiveHistoryEntry> =>
  apiRequest<LiveHistoryEntry>(`/machines/${machineId}/history`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(entry),
  });

export const uploadMachinePhotoRequest = (
  accessToken: string,
  target: { machineId: string; entryId: string },
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<MachinePhotoUploadResponse> =>
  uploadMultipart<MachinePhotoUploadResponse>(`/machines/${target.machineId}/history/${target.entryId}/photos`, {
    accessToken,
    file,
    onProgress,
  });

// Soft delete; needs the "Delete machine photos" permission.
export const deleteMachinePhotoRequest = (
  accessToken: string,
  target: { machineId: string; entryId: string; photoId: string },
): Promise<void> =>
  apiRequest<void>(`/machines/${target.machineId}/history/${target.entryId}/photos/${target.photoId}`, {
    method: "DELETE",
    headers: authorizationHeader(accessToken),
  });
