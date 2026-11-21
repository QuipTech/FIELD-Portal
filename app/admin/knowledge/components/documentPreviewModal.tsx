"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { getKnowledgePreviewUrlRequest } from "@/lib/api/adminKnowledgeApi";
import type { KnowledgeDocument } from "@/lib/types/adminDocument";

interface DocumentPreviewModalProps {
  document: KnowledgeDocument;
  onDownload: () => void;
  onClose: () => void;
}

const PREVIEW_FAILED_MESSAGE = "Couldn't open the preview. Please try again.";

// Browsers only render PDFs inline; Word files can only be downloaded.
const isPdf = (document: KnowledgeDocument) =>
  document.contentType === "application/pdf" || (document.fileName?.toLowerCase().endsWith(".pdf") ?? false);

// A failed document's full indexing error, shown above the preview so it
// can be read and copied (the table row truncates it to one line).
const IndexingErrorBanner = ({ message }: { message: string }) => (
  <div role="alert" className="flex-none border-b border-dangerBorder bg-dangerTint px-4 py-3">
    <div className="text-xs font-medium uppercase tracking-wide text-danger">Indexing failed</div>
    <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs text-danger select-text">
      {message}
    </p>
  </div>
);

const PreviewMessage = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-sm text-mutedGray">{children}</div>
);

export const DocumentPreviewModal = ({ document, onDownload, onClose }: DocumentPreviewModalProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canPreview = isPdf(document);
  const indexingError = document.state === "failed" ? document.errorMessage : null;

  useEffect(() => {
    if (!canPreview) return;
    getKnowledgePreviewUrlRequest(requireAccessToken(), document.id).then(
      ({ url }) => setPreviewUrl(url),
      (error: unknown) => setLoadError(toApiErrorMessage(error, PREVIEW_FAILED_MESSAGE)),
    );
  }, [canPreview, document.id]);

  const renderBody = () => {
    if (!canPreview) {
      return (
        <PreviewMessage>
          This file type can&apos;t be previewed in the browser.
          <Button size="sm" onClick={onDownload}>
            Download
          </Button>
        </PreviewMessage>
      );
    }
    if (loadError) return <PreviewMessage><span className="text-danger">{loadError}</span></PreviewMessage>;
    if (!previewUrl) return <PreviewMessage><LoadingSpinner /> Loading preview…</PreviewMessage>;
    // FitH: Chrome/Edge's viewer opens the page at the frame's full width.
    return <iframe src={`${previewUrl}#view=FitH`} title={document.title} className="min-h-0 w-full flex-1 border-0" />;
  };

  return (
    <Modal title={document.title} onClose={onClose} widthClassName="w-[95vw]">
      <div className="flex h-[calc(90vh-3.5rem)] flex-col">
        {indexingError && <IndexingErrorBanner message={indexingError} />}
        {renderBody()}
      </div>
    </Modal>
  );
};
