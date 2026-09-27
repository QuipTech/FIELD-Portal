"use client";

import { useRef, useState, type DragEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { ACCEPTED_KNOWLEDGE_FILES } from "@/lib/format/knowledgeUploadFile";
import type { KnowledgeDocument } from "@/lib/types/adminDocument";
import { DocumentsTable } from "./documentsTable";
import { UploadDocumentsModal } from "./uploadDocumentsModal";
import { UploadProgressList } from "./uploadProgressList";
import { DeleteDocumentDialog } from "./deleteDocumentDialog";
import { useKnowledgeDocuments } from "../useKnowledgeDocuments";
import { useKnowledgeUploads } from "../useKnowledgeUploads";

const DOWNLOAD_FAILED_MESSAGE = "Couldn't download the document. Please try again.";

export const KnowledgeLibrary = () => {
  const { documents, total, isLoading, loadError, reloadDocuments, downloadDocument, deleteDocument } =
    useKnowledgeDocuments();
  const { uploads, startUploads, clearFinishedUploads } = useKnowledgeUploads(reloadDocuments);
  const [selectedFiles, setSelectedFiles] = useState<File[] | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<KnowledgeDocument | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chooseFiles = (fileList: FileList | null) => {
    if (fileList?.length) setSelectedFiles(Array.from(fileList));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingOver(false);
    chooseFiles(event.dataTransfer.files);
  };

  const handleDownload = (document: KnowledgeDocument) => {
    setActionError(null);
    downloadDocument(document.id).catch((error: unknown) =>
      setActionError(toApiErrorMessage(error, DOWNLOAD_FAILED_MESSAGE)),
    );
  };

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-[22px] font-medium text-ink">Knowledge</h1>
        <Button variant="primary" className="ml-auto" onClick={() => fileInputRef.current?.click()}>
          <Icon name="upload" />
          Upload documents
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_KNOWLEDGE_FILES}
          className="hidden"
          onChange={(event) => {
            chooseFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        {actionError && <span className="text-xs text-danger">{actionError}</span>}
        {!loadError && (
          <span className="ml-auto text-xs text-slate-400">
            {total.toLocaleString("en-GB")} {total === 1 ? "document" : "documents"}
          </span>
        )}
      </div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={`flex flex-none flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-5 text-center text-xs text-mutedGray ${
          isDraggingOver ? "border-primary bg-primaryTint" : "border-borderGrayStrong"
        }`}
      >
        <Icon name="cloud" className="h-6 w-6" />
        Drop PDFs or manuals here — parse &amp; index progress is shown per file
      </div>
      <UploadProgressList uploads={uploads} onClearFinished={clearFinishedUploads} />
      <DocumentsTable
        documents={documents}
        isLoading={isLoading}
        loadError={loadError}
        onDownload={handleDownload}
        onDelete={setDocumentToDelete}
      />
      {selectedFiles && (
        <UploadDocumentsModal files={selectedFiles} onUpload={startUploads} onClose={() => setSelectedFiles(null)} />
      )}
      {documentToDelete && (
        <DeleteDocumentDialog
          document={documentToDelete}
          onDelete={deleteDocument}
          onClose={() => setDocumentToDelete(null)}
        />
      )}
    </>
  );
};
