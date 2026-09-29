"use client";

import { useRef, useState, type DragEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { ACCEPTED_KNOWLEDGE_FILES } from "@/lib/format/knowledgeUploadFile";
import { DocumentsTable } from "./documentsTable";
import { UploadDocumentsModal } from "./uploadDocumentsModal";
import { UploadProgressList } from "./uploadProgressList";
import { DeleteDocumentDialog } from "./deleteDocumentDialog";
import { RejectDocumentDialog } from "./rejectDocumentDialog";
import { useKnowledgeDocuments } from "../useKnowledgeDocuments";
import { useKnowledgeUploads } from "../useKnowledgeUploads";
import { useDocumentRowActions } from "../useDocumentRowActions";


export const KnowledgeLibrary = () => {
  const { documents, total, isLoading, loadError, reloadDocuments, downloadDocument, runAction, rejectDocument, deleteDocument } =
    useKnowledgeDocuments();
  const { uploads, startUploads, startVersionUpload, clearFinishedUploads } = useKnowledgeUploads(reloadDocuments);
  const rowActions = useDocumentRowActions({ downloadDocument, runAction, startVersionUpload });
  const [selectedFiles, setSelectedFiles] = useState<File[] | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chooseFiles = (fileList: FileList | null) => {
    if (fileList?.length) setSelectedFiles(Array.from(fileList));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingOver(false);
    chooseFiles(event.dataTransfer.files);
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
        {rowActions.actionError && <span className="text-xs text-danger">{rowActions.actionError}</span>}
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
        onAction={rowActions.handleAction}
      />
      {selectedFiles && (
        <UploadDocumentsModal files={selectedFiles} onUpload={startUploads} onClose={() => setSelectedFiles(null)} />
      )}
      {rowActions.documentToDelete && (
        <DeleteDocumentDialog document={rowActions.documentToDelete} onDelete={deleteDocument} onClose={rowActions.closeDelete} />
      )}
      {rowActions.documentToReject && (
        <RejectDocumentDialog document={rowActions.documentToReject} onReject={rejectDocument} onClose={rowActions.closeReject} />
      )}
      {rowActions.versionPickerInput}
    </>
  );
};
