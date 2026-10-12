import { apiDownloadRequest, apiRequest } from "./httpClient";
import { uploadMultipart } from "./multipartUpload";
import type { MachineComponent, MachineSystem } from "../types/machineComponent";
import type { DiffExportFormat, Snapshot, SnapshotDiff } from "../types/configurationDiff";
import type { GalleryPhotoResponse } from "../types/machineHistory";

// A machine's systems & components, configuration snapshots and photo
// gallery, within the caller's organisation.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const listSystemsRequest = (accessToken: string, machineId: string) =>
  apiRequest<MachineSystem[]>(`/machines/${machineId}/systems`, { headers: authorizationHeader(accessToken) });

export const listComponentsRequest = (accessToken: string, machineId: string, systemId: string | null) =>
  apiRequest<MachineComponent[]>(
    `/machines/${machineId}/components${systemId ? `?system=${encodeURIComponent(systemId)}` : ""}`,
    { headers: authorizationHeader(accessToken) },
  );

export const listSnapshotsRequest = (accessToken: string, machineId: string) =>
  apiRequest<Snapshot[]>(`/machines/${machineId}/snapshots`, { headers: authorizationHeader(accessToken) });

export const takeSnapshotRequest = (accessToken: string, machineId: string) =>
  apiRequest<Snapshot>(`/machines/${machineId}/snapshots`, { method: "POST", headers: authorizationHeader(accessToken) });

// Needs machine.manage.
export const updateSnapshotRequest = (accessToken: string, target: { machineId: string; snapshotId: string }, isKnownGood: boolean) =>
  apiRequest<Snapshot>(`/machines/${target.machineId}/snapshots/${target.snapshotId}`, {
    method: "PATCH",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify({ isKnownGood }),
  });

const diffQuery = (fromId: string, toId: string) => new URLSearchParams({ from: fromId, to: toId });

export const getSnapshotDiffRequest = (accessToken: string, machineId: string, fromId: string, toId: string) =>
  apiRequest<SnapshotDiff>(`/machines/${machineId}/snapshots/diff?${diffQuery(fromId, toId)}`, {
    headers: authorizationHeader(accessToken),
  });

export const exportSnapshotDiffRequest = async (
  accessToken: string,
  target: { machineId: string; fromId: string; toId: string },
  format: DiffExportFormat,
): Promise<Blob> => {
  const query = diffQuery(target.fromId, target.toId);
  query.set("format", format);
  const { blob } = await apiDownloadRequest(`/machines/${target.machineId}/snapshots/diff/export?${query}`, {
    headers: authorizationHeader(accessToken),
  });
  return blob;
};

export const listGalleryPhotosRequest = (accessToken: string, machineId: string) =>
  apiRequest<GalleryPhotoResponse[]>(`/machines/${machineId}/photos`, { headers: authorizationHeader(accessToken) });

// Needs machine.manage. JPG/PNG/HEIC up to 10 MB.
export const uploadGalleryPhotoRequest = (accessToken: string, machineId: string, file: File) =>
  uploadMultipart<GalleryPhotoResponse>(`/machines/${machineId}/photos`, { accessToken, file });
