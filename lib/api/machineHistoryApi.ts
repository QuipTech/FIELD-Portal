import { apiRequest } from "./httpClient";
import { uploadMultipart } from "./multipartUpload";
import type {
  LiveHistoryEntry,
  LiveHistoryEntryType,
  MachineDetailResponse,
  MachinePhotoUploadResponse,
} from "../types/machineHistory";

export interface HistoryListParams {
  type?: string;
  from?: string;
  author?: string;
  limit?: number;
  offset?: number;
}

export interface NewHistoryEntryRequest {
  entryType: LiveHistoryEntryType;
  description: string;
  componentId?: string;
  componentReplaced?: boolean;
  operatingHours?: number;
  downtimeHours?: number;
}

// A machine's technical history and photos, within the caller's organisation.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const getMachineRequest = (accessToken: string, machineId: string): Promise<MachineDetailResponse> =>
  apiRequest<MachineDetailResponse>(`/machines/${machineId}`, { headers: authorizationHeader(accessToken) });

// Newest first; filters and paging are optional (no limit = everything).
export const listMachineHistoryRequest = (
  accessToken: string,
  machineId: string,
  params: HistoryListParams = {},
): Promise<LiveHistoryEntry[]> => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => value !== undefined && value !== "" && query.set(key, String(value)));
  return apiRequest<LiveHistoryEntry[]>(`/machines/${machineId}/history?${query}`, { headers: authorizationHeader(accessToken) });
};

export const listHistoryAuthorsRequest = (accessToken: string, machineId: string) =>
  apiRequest<{ id: string; name: string }[]>(`/machines/${machineId}/history/authors`, {
    headers: authorizationHeader(accessToken),
  });

export const createHistoryEntryRequest = (
  accessToken: string,
  machineId: string,
  entry: NewHistoryEntryRequest,
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
