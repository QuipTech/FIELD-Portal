"use client";

import { useState } from "react";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { StorageUploadError } from "@/lib/api/signedUrlUpload";
import type { KnowledgeDocumentType } from "@/lib/types/adminDocument";
import { uploadKnowledgeDocument } from "./uploadKnowledgeDocument";

export interface PendingUpload {
  file: File;
  title: string;
}

export interface UploadProgress {
  id: string;
  fileName: string;
  fraction: number;
  status: "uploading" | "done" | "failed";
  errorMessage?: string;
}

const UPLOAD_FAILED_MESSAGE = "Upload failed. Please try again.";

// Uploads run one after another so a batch of large manuals doesn't
// saturate the connection; each file reports its own progress.
export const useKnowledgeUploads = (onUploaded: () => void) => {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  const updateUpload = (id: string, change: Partial<UploadProgress>) =>
    setUploads((current) => current.map((upload) => (upload.id === id ? { ...upload, ...change } : upload)));

  const startUploads = async (pending: PendingUpload[], type: KnowledgeDocumentType) => {
    const batch = pending.map((item) => ({ ...item, id: crypto.randomUUID() }));
    setUploads((current) => [
      ...current,
      ...batch.map(({ id, file }) => ({ id, fileName: file.name, fraction: 0, status: "uploading" as const })),
    ]);

    for (const { id, file, title } of batch) {
      try {
        await uploadKnowledgeDocument(requireAccessToken(), file, { title, type }, (fraction) =>
          updateUpload(id, { fraction }),
        );
        updateUpload(id, { status: "done", fraction: 1 });
      } catch (error) {
        const errorMessage =
          error instanceof StorageUploadError ? error.message : toApiErrorMessage(error, UPLOAD_FAILED_MESSAGE);
        updateUpload(id, { status: "failed", errorMessage });
      }
      onUploaded();
    }
  };

  const clearFinishedUploads = () => setUploads((current) => current.filter((upload) => upload.status === "uploading"));

  return { uploads, startUploads, clearFinishedUploads };
};
