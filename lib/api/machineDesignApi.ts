import { apiRequest } from "./httpClient";

export type DesignStatus = "waiting" | "downloading" | "arrived" | "failed";

export interface DesignVersion {
  id: string;
  projectId: string;
  project: string;
  createdAt: string;
  files: { path: string; sizeBytes: number; sha256: string }[];
}

export interface DesignTarget {
  deviceId: string;
  machineId: string;
  tenantId: string;
  organisation: string;
  label: string;
  site: string | null;
}

interface Delivery {
  id: string;
  versionId: string;
  versionCreatedAt: string;
  project: string;
  machineLabel: string;
  site: string | null;
  status: DesignStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DesignDestination = { machineIds: string[] } | { site: string; siteTenantId: string };
export type PreviewRequest = DesignDestination & { versionId: string };

export interface DesignPreview {
  version: DesignVersion;
  targets: (DesignTarget & {
    replaces: { versionId: string; paths: string[]; status: DesignStatus } | null;
  })[];
  previewHash: string;
}

const request = <T>(token: string, path = "", method = "GET", body?: FormData | object) =>
  apiRequest<T>(`/mc/designs${path}`, {
    method,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

export const listDesigns = (token: string) =>
  request<{ versions: DesignVersion[]; deliveries: Delivery[] }>(token);
export const listDesignTargets = (token: string) => request<DesignTarget[]>(token, "/targets");
export const uploadDesign = (token: string, body: FormData) =>
  request<DesignVersion>(token, "/versions", "POST", body);
export const previewDesign = (token: string, body: PreviewRequest) =>
  request<DesignPreview>(token, "/preview", "POST", body);
export const sendDesign = (token: string, body: PreviewRequest & { batchId: string; previewHash: string }) =>
  request<{ batchId: string }>(token, "/deliveries", "POST", body);
export const getDesignDownload = (token: string, id: string, index: number) =>
  request<{ url: string }>(token, `/versions/${id}/files/${index}`);
