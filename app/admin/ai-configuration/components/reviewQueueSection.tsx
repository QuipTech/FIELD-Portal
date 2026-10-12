"use client";

import { useState } from "react";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import type { ReviewQueueItem, ReviewStatus } from "@/lib/types/aiConfiguration";
import { useReviewQueue } from "../useReviewQueue";
import { REVIEW_STATUS_OPTIONS } from "../reviewQueueLabels";
import { ReviewQueueTable } from "./reviewQueueTable";
import { ReviewItemModal } from "./reviewItemModal";

const filterClasses = "h-8 rounded-md border border-borderGrayStrong bg-surface px-2 text-xs text-bodyGray";

export const ReviewQueueSection = () => {
  const queue = useReviewQueue();
  const [openItem, setOpenItem] = useState<ReviewQueueItem | null>(null);
  const counts = queue.page?.statusCounts ?? {};

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2 border-t border-borderGray pt-4">
        <h2 className="text-base font-medium text-ink">Review queue</h2>
        <span className="text-xs text-mutedGray">Conversations flagged for admin review</span>
        <div className="ml-auto flex gap-2">
          <select
            aria-label="Status"
            value={queue.status}
            onChange={(event) => queue.setStatus(event.target.value as ReviewStatus | "")}
            className={filterClasses}
          >
            <option value="">All statuses</option>
            {REVIEW_STATUS_OPTIONS.map((option) => (
              <option key={option.status} value={option.status}>
                {option.label} · {counts[option.status] ?? 0}
              </option>
            ))}
          </select>
          <select
            aria-label="Reviewer"
            value={queue.reviewerId}
            onChange={(event) => queue.setReviewerId(event.target.value)}
            className={filterClasses}
          >
            <option value="">Any reviewer</option>
            {queue.reviewers.map((reviewer) => (
              <option key={reviewer.id} value={reviewer.id}>
                {reviewer.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {queue.isLoading && !queue.page && (
        <span className="flex items-center gap-2 py-6 text-sm text-mutedGray">
          <LoadingSpinner /> Loading review queue…
        </span>
      )}
      {queue.loadError && <span className="text-sm text-danger">{queue.loadError}</span>}
      {queue.page && <ReviewQueueTable items={queue.page.items} onOpen={setOpenItem} />}
      <p className="mt-3 px-1 text-xs text-slate-400">
        Flag reasons: no source found · low confidence · technician marked the answer wrong · safety refusal.
      </p>
      {openItem && <ReviewItemModal item={openItem} onUpdate={queue.updateItem} onClose={() => setOpenItem(null)} />}
    </>
  );
};
