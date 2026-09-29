"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { ReviewQueueItem, ReviewStatus } from "@/lib/types/aiConfiguration";
import { getReviewReasonLabel, getReviewStatusMeta } from "../reviewQueueLabels";

interface ReviewItemModalProps {
  item: ReviewQueueItem;
  onUpdate: (itemId: string, change: { status?: ReviewStatus; notes?: string }) => Promise<unknown>;
  onClose: () => void;
}

// The next steps offered for each status.
const actionsByStatus: Record<ReviewStatus, { status: ReviewStatus; label: string }[]> = {
  unreviewed: [{ status: "in_review", label: "Start review" }],
  in_review: [
    { status: "unreviewed", label: "Return to queue" },
    { status: "escalated", label: "Escalate" },
    { status: "resolved", label: "Resolve" },
  ],
  escalated: [{ status: "resolved", label: "Resolve" }],
  resolved: [{ status: "in_review", label: "Reopen" }],
};

const sectionLabelClasses = "text-xs font-medium uppercase tracking-wide text-mutedGray";

export const ReviewItemModal = ({ item, onUpdate, onClose }: ReviewItemModalProps) => {
  const [notes, setNotes] = useState(item.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const statusMeta = getReviewStatusMeta(item.status);

  const applyChange = async (status?: ReviewStatus) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onUpdate(item.id, { status, notes: notes.trim() === (item.notes ?? "") ? undefined : notes.trim() });
      onClose();
    } catch (error) {
      setSaveError(toApiErrorMessage(error, "Couldn't update this item. Please try again."));
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Flagged conversation" onClose={isSaving ? undefined : onClose} widthClassName="w-[640px]">
      <div className="flex flex-col gap-3.5 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-mutedGray">
          <Tag tone={statusMeta.tone}>{statusMeta.label}</Tag>
          <span>{getReviewReasonLabel(item.reasonCode, item.reason)}</span>
          <span>· {item.organisationName}</span>
          {item.reviewer && <span>· Reviewer: {item.reviewer.name}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <span className={sectionLabelClasses}>Technician asked</span>
          <p className="text-sm text-ink">{item.question ?? "(question unavailable)"}</p>
        </div>
        <div className="flex flex-col gap-1">
          <span className={sectionLabelClasses}>Assistant answered</span>
          <p className="max-h-[30vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-fillGray p-3 text-sm text-ink">
            {item.answer}
          </p>
        </div>
        <label className="flex flex-col gap-1">
          <span className={sectionLabelClasses}>Review notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={4000}
            className="rounded-lg border border-borderGrayStrong bg-surface p-3 text-sm text-ink outline-none"
          />
        </label>
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => applyChange()} disabled={isSaving}>
            Save notes
          </Button>
          <div className="ml-auto flex gap-2">
            {actionsByStatus[item.status].map((action) => (
              <Button
                key={action.status}
                variant={
                  action.status === "escalated" ? "danger" : action.status === "resolved" ? "primary" : "default"
                }
                onClick={() => applyChange(action.status)}
                disabled={isSaving}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
