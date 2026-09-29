"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { uploadDocumentRequest } from "@/lib/api/documentsApi";
import { useFileUpload } from "@/lib/uploads/useFileUpload";
import { useFilePicker } from "@/lib/uploads/useFilePicker";
import { knowledgeDocumentTypes, type KnowledgeDocument, type KnowledgeDocumentType } from "@/lib/types/adminDocument";
import { UploadProgressBar } from "./uploadProgressBar";

interface DocumentUploaderProps {
  onUploaded: (document: KnowledgeDocument) => void;
}

// Uploads a PDF/Word document (≤ 20 MB) to the caller's organisation
// through POST /documents. Needs the "Submit knowledge items" permission.
export const DocumentUploader = ({ onUploaded }: DocumentUploaderProps) => {
  const [type, setType] = useState<KnowledgeDocumentType>("manual");
  const { upload, progress, isUploading, errorMessage } = useFileUpload((file, onProgress) =>
    uploadDocumentRequest(requireAccessToken(), file, { type }, onProgress),
  );
  const picker = useFilePicker(".pdf,.doc,.docx", async (file) => {
    const result = await upload(file);
    if (result) onUploaded(result.document);
  });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <select
          aria-label="Document type"
          value={type}
          onChange={(event) => setType(event.target.value as KnowledgeDocumentType)}
          disabled={isUploading}
          className="h-9 rounded-lg border border-borderGrayStrong bg-surface px-2 text-sm text-ink"
        >
          {knowledgeDocumentTypes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <PermissionButton permission={PERMISSIONS.submitDocuments} size="sm" onClick={picker.open} disabled={isUploading}>
          <Icon name="upload" className="h-3.5 w-3.5" />
          {isUploading ? `Uploading ${Math.round((progress ?? 0) * 100)}%` : "Upload document"}
        </PermissionButton>
        {picker.input}
      </div>
      {isUploading && <UploadProgressBar fraction={progress ?? 0} />}
      {errorMessage && <span className="text-xs text-danger">{errorMessage}</span>}
    </div>
  );
};
