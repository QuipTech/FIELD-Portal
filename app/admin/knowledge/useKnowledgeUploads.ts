"use client";

import { useState } from "react";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { StorageUploadError } from "@/lib/api/signedUrlUpload";
import type { KnowledgeClassification } from "@/lib/types/knowledgeBrand";
import type { KnowledgeDocumentType } from "@/lib/types/adminDocument";
import { uploadKnowledgeDocument, uploadKnowledgeVersion } from "./uploadKnowledgeDocument";

export interface PendingUpload {
  file: File;
  title: string;
}

export interface UploadProgress {
  id: string;
  fileName: string;
  fraction: number;
  status: "uploading" | "failed";
  errorMessage?: string;
}

const UPLOAD_FAILED_MESSAGE = "Upload failed. Please try again.";

const toUploadErrorMessage = (error: unknown): string =>
  error instanceof StorageUploadError ? error.message : toApiErrorMessage(error, UPLOAD_FAILED_MESSAGE);

// Uploads run one after another so a batch of large manuals doesn't
// saturate the connection; each file reports its own progress. A finished
// upload leaves the progress list once the reloaded table shows it; failed
// ones stay so the error can be read.
export const useKnowledgeUploads = (onUploaded: () => Promise<void>) => {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  const removeUpload = (id: string) => setUploads((current) => current.filter((upload) => upload.id !== id));

  const updateUpload = (id: string, change: Partial<UploadProgress>) =>
    setUploads((current) => current.map((upload) => (upload.id === id ? { ...upload, ...change } : upload)));

  const startUploads = async (
    pending: PendingUpload[],
    type: KnowledgeDocumentType,
    classification: KnowledgeClassification,
  ) => {
    const batch = pending.map((item) => ({ ...item, id: crypto.randomUUID() }));
    setUploads((current) => [
      ...current,
      ...batch.map(({ id, file }) => ({ id, fileName: file.name, fraction: 0, status: "uploading" as const })),
    ]);

    for (const { id, file, title } of batch) {
      try {
        await uploadKnowledgeDocument(requireAccessToken(), file, { title, type, ...classification }, (fraction) =>
          updateUpload(id, { fraction }),
        );
        await onUploaded();
        removeUpload(id);
      } catch (error) {
        updateUpload(id, { status: "failed", errorMessage: toUploadErrorMessage(error) });
        void onUploaded();
      }
    }
  };

  // A new version of one existing document, shown in the same progress list.
  const startVersionUpload = async (documentId: string, file: File) => {
    const id = crypto.randomUUID();
    setUploads((current) => [
      ...current,
      { id, fileName: `${file.name} (new version)`, fraction: 0, status: "uploading" },
    ]);
    try {
      await uploadKnowledgeVersion(requireAccessToken(), documentId, file, (fraction) =>
        updateUpload(id, { fraction }),
      );
      await onUploaded();
      removeUpload(id);
    } catch (error) {
      updateUpload(id, { status: "failed", errorMessage: toUploadErrorMessage(error) });
      void onUploaded();
    }
  };

  const clearFinishedUploads = () => setUploads((current) => current.filter((upload) => upload.status === "uploading"));

  return { uploads, startUploads, startVersionUpload, clearFinishedUploads };
};
