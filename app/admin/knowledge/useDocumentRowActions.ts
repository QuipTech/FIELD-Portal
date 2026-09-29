"use client";

import { useState } from "react";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { useFilePicker } from "@/lib/uploads/useFilePicker";
import { ACCEPTED_KNOWLEDGE_FILES } from "@/lib/format/knowledgeUploadFile";
import type { KnowledgeDocument } from "@/lib/types/adminDocument";
import type { DocumentRowAction } from "./documentRowActions";
import type { DocumentAction } from "./useKnowledgeDocuments";

const ACTION_FAILED_MESSAGE = "That didn't work. Please try again.";

interface RowActionHandlers {
  downloadDocument: (documentId: string) => Promise<void>;
  runAction: (documentId: string, action: DocumentAction) => Promise<void>;
  startVersionUpload: (documentId: string, file: File) => Promise<void>;
}

// Routes a row's ⋯ menu choice: quick actions run straight away (errors
// shown above the table); reject and delete open a dialog; "New version"
// opens the file picker for that document.
export const useDocumentRowActions = ({ downloadDocument, runAction, startVersionUpload }: RowActionHandlers) => {
  const [actionError, setActionError] = useState<string | null>(null);
  const [documentToReject, setDocumentToReject] = useState<KnowledgeDocument | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<KnowledgeDocument | null>(null);
  const [versionTargetId, setVersionTargetId] = useState<string | null>(null);
  const versionPicker = useFilePicker(ACCEPTED_KNOWLEDGE_FILES, (file) => {
    if (versionTargetId) void startVersionUpload(versionTargetId, file);
  });

  const report = (promise: Promise<void>) =>
    promise.catch((error: unknown) => setActionError(toApiErrorMessage(error, ACTION_FAILED_MESSAGE)));

  const handleAction = (document: KnowledgeDocument, action: DocumentRowAction) => {
    setActionError(null);
    switch (action) {
      case "approve":
      case "retry":
      case "archive":
        return report(runAction(document.id, action));
      case "download":
        return report(downloadDocument(document.id));
      case "reject":
        return setDocumentToReject(document);
      case "delete":
        return setDocumentToDelete(document);
      case "newVersion":
        setVersionTargetId(document.id);
        return versionPicker.open();
    }
  };

  return {
    handleAction,
    actionError,
    documentToReject,
    closeReject: () => setDocumentToReject(null),
    documentToDelete,
    closeDelete: () => setDocumentToDelete(null),
    versionPickerInput: versionPicker.input,
  };
};
