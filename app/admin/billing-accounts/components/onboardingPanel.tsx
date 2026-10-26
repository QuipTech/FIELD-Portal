"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Tag } from "@/components/ui/tag";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { completeOnboardingRequest, listOnboardingJobsRequest, waiveOnboardingRequest } from "@/lib/api/adminBillingOperationsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { formatBillingDay } from "@/lib/format/billingDay";
import type { OnboardingJob } from "@/lib/types/adminBillingOperations";
import { AdminPromptDialog } from "./adminPromptDialog";

const STATUS_TONES = { scheduled: "amber", completed: "ok", waived: "default" } as const;

// Assisted onboarding jobs (billing spec section 7). Schedule one from a
// billing account's menu; completing it invoices the site once.
export const OnboardingPanel = () => {
  const jobs = useApiResource(listOnboardingJobsRequest, [], "Couldn't load onboarding jobs.");
  const [acting, setActing] = useState<{ job: OnboardingJob; action: "complete" | "waive" } | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-bodyGray">
        A$2,500 per site from the price book, invoiced once when the job is completed. Fleet self-import is always free.
        Schedule a job from a billing account&apos;s menu.
      </p>
      {jobs.isLoading && !jobs.data && <span className="flex items-center gap-2 text-sm text-mutedGray"><LoadingSpinner /> Loading…</span>}
      {jobs.error && <p className="text-sm text-danger">{jobs.error}</p>}
      {jobs.data?.length === 0 && <p className="text-sm text-bodyGray">No onboarding jobs yet.</p>}
      {jobs.data?.map((job) => (
        <article key={job.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-borderGray bg-surface p-4">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium text-ink">{job.siteName}</span>
            <span className="text-sm text-bodyGray">
              {job.accountName} · scheduled {formatBillingDay(job.createdAt)}
              {job.completedAt && ` · completed ${formatBillingDay(job.completedAt)}`}
              {job.waivedReason && ` · waived: ${job.waivedReason}`}
            </span>
          </div>
          <Tag tone={STATUS_TONES[job.status]}>{job.status[0].toUpperCase() + job.status.slice(1)}</Tag>
          {job.status === "scheduled" && (
            <>
              <Button size="sm" variant="primary" onClick={() => setActing({ job, action: "complete" })}>Complete and invoice</Button>
              <Button size="sm" onClick={() => setActing({ job, action: "waive" })}>Waive</Button>
            </>
          )}
        </article>
      ))}
      {acting?.action === "complete" && (
        <ConfirmDialog
          title={`Complete onboarding: ${acting.job.siteName}`}
          confirmLabel="Complete and invoice"
          confirmVariant="primary"
          onConfirm={async () => {
            await completeOnboardingRequest(requireAccessToken(), acting.job.id);
            setActing(null);
            jobs.reload();
          }}
          onClose={() => setActing(null)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't complete the job.")}
        >
          {acting.job.accountName} is invoiced once for this site at today&apos;s assisted onboarding price, with GST added.
        </ConfirmDialog>
      )}
      {acting?.action === "waive" && (
        <AdminPromptDialog
          title={`Waive onboarding: ${acting.job.siteName}`}
          description="Nothing is invoiced. The reason is kept in the audit log."
          confirmLabel="Waive"
          fields={[{ name: "reason", label: "Reason" }]}
          onConfirm={async ({ reason }) => {
            await waiveOnboardingRequest(requireAccessToken(), acting.job.id, String(reason));
            setActing(null);
            jobs.reload();
          }}
          onClose={() => setActing(null)}
        />
      )}
    </div>
  );
};
