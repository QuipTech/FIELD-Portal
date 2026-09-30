import { apiRequest } from "./httpClient";

// Profile & settings → My data, for the signed-in user.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export interface DataExportStatus {
  id: string;
  status: "queued" | "running" | "ready" | "failed" | "expired";
  requestedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  // A short-lived signed link, only while the export is ready.
  downloadUrl: string | null;
  sizeBytes: number | null;
}

// The newest export, or null if none was ever requested.
export const getDataExportRequest = (accessToken: string) =>
  apiRequest<DataExportStatus | null>("/me/data-export", { headers: authorizationHeader(accessToken) });

// Queued and built in the background; 409 while one is already in progress.
export const requestDataExportRequest = (accessToken: string) =>
  apiRequest<DataExportStatus>("/me/data-export", { method: "POST", headers: authorizationHeader(accessToken) });
