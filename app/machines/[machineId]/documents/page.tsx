"use client";

import { useState } from "react";
import { PermissionButton } from "@/components/auth/permissionButton";
import { Icon } from "@/components/icons/icon";
import { DocumentViewer } from "@/components/machines/documentViewer/documentViewer";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { EmptyState } from "@/components/ui/emptyState";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { SelectInput } from "@/components/ui/selectInput";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { canContributeTo } from "@/lib/machineDetail/machineAccessRules";
import { MACHINE_DOCUMENT_TYPES, machineDocumentTypeLabels, type MachineDocument, type MachineDocumentType } from "@/lib/types/machineDocument";
import { useMachineDetail } from "../machineDetailContext";
import { DocumentsList } from "./components/documentsList";
import { UploadDocumentDialog } from "./components/uploadDocumentDialog";
import { useMachineDocuments } from "./useMachineDocuments";

// Documents tab: every file for this machine, including those added with a
// history entry. Files that belong to everyone's record are only soft deleted.
const MachineDocumentsPage = () => {
  const { machineId, machine, service, notify } = useMachineDetail();
  const documents = useMachineDocuments(service, machineId);
  const [typeFilter, setTypeFilter] = useState<MachineDocumentType | "">("");
  const [isUploading, setIsUploading] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<MachineDocument | null>(null);
  const [documentToView, setDocumentToView] = useState<MachineDocument | null>(null);
  const items = documents.data ?? [];
  const visible = typeFilter ? items.filter((document) => document.documentType === typeFilter) : items;
  const canUpload = canContributeTo(machine);

  const uploadButton = (label: string, className?: string) =>
    canUpload && (
      <PermissionButton permission={PERMISSIONS.addHistoryEntry} variant="primary" className={className} onClick={() => setIsUploading(true)}>
        <Icon name="upload" />
        {label}
      </PermissionButton>
    );

  const renderContent = () => {
    if (documents.isLoading && !documents.data) {
      return (
        <div aria-busy="true" aria-label="Loading documents" className="flex flex-col gap-3">
          {[0, 1, 2].map((row) => (
            <SkeletonBar key={row} className="h-10 w-full" />
          ))}
        </div>
      );
    }
    if (documents.error && !documents.data) return <LoadErrorState message={documents.error} onRetry={documents.reload} />;
    if (items.length === 0) {
      return (
        <EmptyState
          icon="file"
          title="No documents yet"
          description="Keep service reports, inspections and certificates for this machine here, so anyone on the team can find them."
          actions={uploadButton("Upload the first document")}
        />
      );
    }
    if (visible.length === 0) {
      return (
        <EmptyState
          icon="filter"
          title={`No ${machineDocumentTypeLabels[typeFilter as MachineDocumentType].toLowerCase()} documents`}
          description="Try another type."
          actions={<Button onClick={() => setTypeFilter("")}>Show all documents</Button>}
        />
      );
    }
    return <DocumentsList machineId={machineId} documents={visible} onView={setDocumentToView} onDelete={setDocumentToDelete} />;
  };

  return (
    <section className="flex flex-col gap-4">
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-52">
            <SelectInput
              aria-label="Filter by document type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as MachineDocumentType | "")}
            >
              <option value="">All types</option>
              {MACHINE_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {machineDocumentTypeLabels[type]}
                </option>
              ))}
            </SelectInput>
          </div>
          {uploadButton("Upload document", "ml-auto")}
        </div>
      )}
      {renderContent()}
      {documentToView && (
        <DocumentViewer
          document={{
            fileName: documentToView.fileName,
            contentType: documentToView.contentType,
            url: documentToView.signedUrl,
            downloadUrl: documentToView.downloadUrl,
          }}
          onClose={() => setDocumentToView(null)}
        />
      )}
      {isUploading && (
        <UploadDocumentDialog
          machineLabel={machine?.assetId ?? ""}
          onUpload={(file, documentType, onProgress) => service.uploadDocument(machineId, file, documentType, onProgress)}
          onFinished={(uploadedCount) => {
            if (uploadedCount > 0) {
              documents.reloadAfterChange();
              notify(uploadedCount === 1 ? "Document uploaded" : `${uploadedCount} documents uploaded`);
            }
          }}
          onClose={() => setIsUploading(false)}
        />
      )}
      {documentToDelete && (
        <ConfirmDialog
          title="Delete document"
          confirmLabel="Delete document"
          onConfirm={async () => {
            await service.deleteDocument(machineId, documentToDelete.id);
            documents.reloadAfterChange();
            notify("Document deleted");
          }}
          onClose={() => setDocumentToDelete(null)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't delete the document. Please try again.")}
        >
          {documentToDelete.fileName} is removed from this machine and any history entry it was added to. It stays in the audit record, so the deletion can be traced.
        </ConfirmDialog>
      )}
    </section>
  );
};

export default MachineDocumentsPage;
