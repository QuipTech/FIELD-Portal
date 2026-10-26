"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Tag } from "@/components/ui/tag";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { listReviewTasksRequest, updateReviewTaskRequest } from "@/lib/api/adminBillingOperationsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { formatBillingDay } from "@/lib/format/billingDay";
import type { ReviewTask } from "@/lib/types/adminBillingOperations";
import { AdminPromptDialog } from "./adminPromptDialog";

const TYPE_LABELS: Record<ReviewTask["type"], string> = {
  plan_review: "Plan review",
  enterprise_threshold: "Enterprise threshold",
  abuse_flag: "Abuse flag",
};

// QuipTech's billing follow-ups: plan reviews after two months over a
// fair-use allowance, accounts reaching 500 machines, abuse flags.
// Raising one never blocks the customer.
export const ReviewTasksPanel = () => {
  const [status, setStatus] = useState<"open" | "closed">("open");
  const tasks = useApiResource((token) => listReviewTasksRequest(token, status), [status], "Couldn't load review tasks.");
  const [closing, setClosing] = useState<{ task: ReviewTask; to: "resolved" | "dismissed" } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const markInProgress = async (task: ReviewTask) => {
    setError(null);
    try {
      await updateReviewTaskRequest(requireAccessToken(), task.id, { status: "in_progress" });
      tasks.reload();
    } catch (cause) {
      setError(toApiErrorMessage(cause, "Couldn't update the task."));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="group" aria-label="Show tasks">
        {(["open", "closed"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>
            <Tag tone={status === value ? "primary" : "default"}>{value === "open" ? "Open" : "Closed"}</Tag>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {tasks.isLoading && !tasks.data && <span className="flex items-center gap-2 text-sm text-mutedGray"><LoadingSpinner /> Loading…</span>}
      {tasks.data?.length === 0 && <p className="text-sm text-bodyGray">{status === "open" ? "Nothing to review." : "No closed tasks yet."}</p>}
      {tasks.data?.map((task) => (
        <article key={task.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-borderGray bg-surface p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{task.accountName}</span>
              <Tag tone={task.type === "abuse_flag" ? "danger" : "amber"}>{TYPE_LABELS[task.type]}</Tag>
              {task.status === "in_progress" && <Tag tone="primary">In progress</Tag>}
            </div>
            <span className="text-sm text-bodyGray">{task.reason}</span>
            <span className="text-xs text-mutedGray">Raised {formatBillingDay(task.createdAt)}{task.notes ? ` · ${task.notes}` : ""}</span>
          </div>
          {status === "open" && (
            <div className="flex flex-wrap gap-2">
              {task.status === "open" && <Button size="sm" onClick={() => void markInProgress(task)}>Start</Button>}
              <Button size="sm" variant="primary" onClick={() => setClosing({ task, to: "resolved" })}>Resolve</Button>
              <Button size="sm" variant="ghost" onClick={() => setClosing({ task, to: "dismissed" })}>Dismiss</Button>
            </div>
          )}
        </article>
      ))}
      {closing && (
        <AdminPromptDialog
          title={`${closing.to === "resolved" ? "Resolve" : "Dismiss"}: ${closing.task.accountName}`}
          description="Record what was done, for the audit log."
          confirmLabel={closing.to === "resolved" ? "Resolve" : "Dismiss"}
          fields={[{ name: "notes", label: "Notes", placeholder: "e.g. Moved to annual for 40 machines" }]}
          onConfirm={async ({ notes }) => {
            await updateReviewTaskRequest(requireAccessToken(), closing.task.id, { status: closing.to, notes: String(notes) });
            setClosing(null);
            tasks.reload();
          }}
          onClose={() => setClosing(null)}
        />
      )}
    </div>
  );
};
