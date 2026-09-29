"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { KnowledgeDocument } from "@/lib/types/adminDocument";

interface RejectDocumentDialogProps {
  document: KnowledgeDocument;
  onReject: (documentId: string, reason: string) => Promise<void>;
  onClose: () => void;
}

const REJECT_FAILED_MESSAGE = "Couldn't reject the document. Please try again.";

// The reason is stored with the document and shown in the list.
export const RejectDocumentDialog = ({ document, onReject, onClose }: RejectDocumentDialogProps) => {
  const [reason, setReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) return;
    setIsRejecting(true);
    setRejectError(null);
    try {
      await onReject(document.id, reason.trim());
      onClose();
    } catch (error) {
      setRejectError(toApiErrorMessage(error, REJECT_FAILED_MESSAGE));
      setIsRejecting(false);
    }
  };

  return (
    <Modal title="Reject document" onClose={isRejecting ? undefined : onClose} widthClassName="w-[460px]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <span className="text-sm text-bodyGray">
          <span className="font-medium text-ink">{document.title}</span> will be archived and won&apos;t be used by
          the AI assistant.
        </span>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Reason</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={1000}
            required
            autoFocus
            placeholder="e.g. Superseded by Bulletin 91"
            className="resize-none rounded-lg border border-borderGrayStrong bg-surface p-3 text-[15px] text-ink outline-none placeholder:text-mutedGray"
          />
        </div>
        {rejectError && <span className="text-xs text-danger">{rejectError}</span>}
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isRejecting}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" className="ml-auto" disabled={isRejecting || !reason.trim()}>
            {isRejecting ? "Rejecting…" : "Reject"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
