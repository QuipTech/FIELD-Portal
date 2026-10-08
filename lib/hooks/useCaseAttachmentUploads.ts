"use client";

import { useState } from "react";
import { requireAccessToken } from "../api/requireAccessToken";
import { toApiErrorMessage } from "../api/apiErrorMessage";
import { uploadCaseAttachmentRequest, type CaseThreadScope } from "../api/caseThreadApi";
import type { CaseAttachment } from "../types/caseMessage";

export const MAX_CASE_ATTACHMENTS = 10;

export interface PendingCaseUpload {
  key: string;
  fileName: string;
  progress: number;
  attachment: CaseAttachment | null;
  error: string | null;
}

// Files picked for a message (or the New case form): each uploads at once,
// and the message is sent with the ids of those that finished.
export const useCaseAttachmentUploads = (scope: CaseThreadScope, caseNumber: number | null) => {
  const [uploads, setUploads] = useState<PendingCaseUpload[]>([]);

  const update = (key: string, changes: Partial<PendingCaseUpload>) =>
    setUploads((current) => current.map((upload) => (upload.key === key ? { ...upload, ...changes } : upload)));

  const uploadFile = async (file: File, key: string) => {
    try {
      const attachment = await uploadCaseAttachmentRequest(requireAccessToken(), scope, caseNumber, file, (progress) =>
        update(key, { progress }),
      );
      update(key, { attachment, progress: 1 });
    } catch (error) {
      update(key, { error: toApiErrorMessage(error, `Couldn't upload ${file.name}.`) });
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const room = MAX_CASE_ATTACHMENTS - uploads.length;
    const added = Array.from(files)
      .slice(0, Math.max(0, room))
      .map((file) => ({ file, key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}` }));
    setUploads((current) => [
      ...current,
      ...added.map(({ file, key }) => ({ key, fileName: file.name, progress: 0, attachment: null, error: null })),
    ]);
    added.forEach(({ file, key }) => void uploadFile(file, key));
  };

  const remove = (key: string) => setUploads((current) => current.filter((upload) => upload.key !== key));

  return {
    uploads,
    addFiles,
    remove,
    clear: () => setUploads([]),
    attachmentIds: uploads.flatMap((upload) => (upload.attachment ? [upload.attachment.id] : [])),
    isUploading: uploads.some((upload) => !upload.attachment && !upload.error),
  };
};
