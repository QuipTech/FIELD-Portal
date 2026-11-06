import { apiRequest } from "./httpClient";
import { uploadMultipart } from "./multipartUpload";
import type { MachineDocument, MachineDocumentFile, MachineDocumentType } from "../types/machineDocument";

const documentsPath = (machineId: string) => `/machines/${machineId}/documents`;

// Newest first; filtered on screen, so switching type needs no request.
export const listMachineDocumentsRequest = (accessToken: string, machineId: string): Promise<MachineDocument[]> =>
  apiRequest<MachineDocument[]>(documentsPath(machineId), { headers: { Authorization: `Bearer ${accessToken}` } });

export const uploadMachineDocumentRequest = (
  accessToken: string,
  machineId: string,
  file: File,
  fields: { documentType: MachineDocumentType; historyEntryId?: string },
  onProgress?: (fraction: number) => void,
): Promise<MachineDocumentFile> =>
  uploadMultipart<MachineDocumentFile>(documentsPath(machineId), { accessToken, file, fields, onProgress });

// Soft delete: the file stays in the machine's audit record.
export const deleteMachineDocumentRequest = (accessToken: string, machineId: string, documentId: string): Promise<void> =>
  apiRequest<void>(`${documentsPath(machineId)}/${documentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
