"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Tag } from "@/components/ui/tag";
import type { Tone } from "@/components/ui/tone";
import { useApiResource } from "@/lib/hooks/useApiResource";
import {
  approveApplicationRequest,
  holdApplicationRequest,
  listAccountApplicationsRequest,
  rejectApplicationRequest,
} from "@/lib/api/paymentTermsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { formatBillingDay } from "@/lib/format/billingDay";
import { audMoney } from "@/lib/format/audMoney";
import type { AccountApplication, AccountStatus } from "@/lib/types/paymentTerms";
import { AdminPromptDialog } from "./adminPromptDialog";

const STATUS: Record<Exclude<AccountStatus, "none">, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "amber" },
  on_hold: { label: "On hold", tone: "amber" },
  approved: { label: "Approved", tone: "ok" },
  rejected: { label: "Rejected", tone: "danger" },
};

const FILTERS: { value: AccountStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "on_hold", label: "On hold" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const inputClass = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink outline-none";

const ApproveDialog = ({
  application,
  onSaved,
  onClose,
}: {
  application: AccountApplication;
  onSaved: () => void;
  onClose: () => void;
}) => {
  const [termsDays, setTermsDays] = useState("30");
  const [creditLimit, setCreditLimit] = useState("");
  const [notes, setNotes] = useState("");
  const days = Number(termsDays);
  const limitDollars = creditLimit.trim() ? Number(creditLimit.replace(/[$,\s]/g, "")) : null;
  const isValid =
    Number.isInteger(days) && days >= 1 && days <= 120 && (limitDollars === null || (Number.isFinite(limitDollars) && limitDollars >= 0));
  return (
    <ConfirmDialog
      title={`Approve ${application.application.legalName ?? application.accountName}`}
      confirmLabel="Approve account"
      confirmVariant="primary"
      isConfirmDisabled={!isValid}
      onConfirm={async () => {
        await approveApplicationRequest(requireAccessToken(), application.billingAccountId, {
          termsDays: days,
          creditLimitCents: limitDollars === null ? null : Math.round(limitDollars * 100),
          notes: notes.trim() || null,
        });
        onSaved();
      }}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't approve the account. Please try again.")}
    >
      <div className="flex flex-col gap-3">
        <p>
          From the next invoice, FIELD emails invoices with these terms to pay by bank transfer. No card is charged. The
          organisation&apos;s admins are told by email and in FIELD.
        </p>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Payment terms (days)
          <input value={termsDays} onChange={(event) => setTermsDays(event.target.value)} inputMode="numeric" className={inputClass} />
        </label>
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Credit limit (A$, optional)
            <input
              value={creditLimit}
              onChange={(event) => setCreditLimit(event.target.value)}
              inputMode="decimal"
              placeholder="No limit"
              aria-describedby="credit-limit-hint"
              className={inputClass}
            />
          </label>
          <span id="credit-limit-hint" className="text-xs text-bodyGray">Going over it only warns you; nothing is blocked.</span>
        </div>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Notes (audit log, optional)
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            maxLength={1000}
            className="rounded-lg border border-borderGrayStrong bg-surface px-3 py-2 text-[15px] text-ink outline-none"
          />
        </label>
      </div>
    </ConfirmDialog>
  );
};

type Decision = { application: AccountApplication; action: "approve" | "reject" | "hold" };

// 30-day account applications, pending first. Approving switches the
// organisation to account terms; rejecting asks it to add a card. Every
// decision is audited and the organisation's admins are told.
export const AccountApplicationsPanel = () => {
  const [status, setStatus] = useState<AccountStatus | "">("");
  const applications = useApiResource(
    (token) => listAccountApplicationsRequest(token, status || undefined),
    [status],
    "Couldn't load account applications.",
  );
  const [deciding, setDeciding] = useState<Decision | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const done = (text: string) => {
    setDeciding(null);
    setMessage(text);
    applications.reload();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Show applications">
        {FILTERS.map((filter) => (
          <button key={filter.label} type="button" aria-pressed={status === filter.value} onClick={() => setStatus(filter.value)}>
            <Tag tone={status === filter.value ? "primary" : "default"}>{filter.label}</Tag>
          </button>
        ))}
      </div>
      {message && <p role="status" className="text-sm text-bodyGray">{message}</p>}
      {applications.error && <p className="text-sm text-danger">{applications.error}</p>}
      {applications.isLoading && !applications.data && (
        <span className="flex items-center gap-2 text-sm text-mutedGray"><LoadingSpinner /> Loading…</span>
      )}
      {applications.data?.length === 0 && <p className="text-sm text-bodyGray">No applications.</p>}
      {applications.data?.map((application) => {
        const { application: details } = application;
        const tag = application.accountStatus !== "none" ? STATUS[application.accountStatus] : null;
        const isOpen = application.accountStatus === "pending" || application.accountStatus === "on_hold";
        return (
          <article key={application.billingAccountId} className="flex flex-wrap items-start gap-3 rounded-xl border border-borderGray bg-surface p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{details.legalName ?? application.accountName}</span>
                {tag && <Tag tone={tag.tone}>{tag.label}</Tag>}
                {application.poRequired && <Tag>PO required</Tag>}
              </div>
              <span className="text-sm text-bodyGray">
                {application.organisationNames ?? application.accountName} · ABN {details.abn ?? "—"}
              </span>
              <span className="text-sm text-bodyGray">
                {details.accountsEmail ?? "—"} · {details.accountsPhone ?? "—"}
              </span>
              {details.notes && <span className="text-sm text-bodyGray">“{details.notes}”</span>}
              <span className="text-xs text-mutedGray">
                {details.appliedAt ? `Applied ${formatBillingDay(details.appliedAt)}` : ""}
                {application.accountStatus === "approved" &&
                  ` · ${application.termsDays} days${application.creditLimitCents !== null ? ` · limit ${audMoney(application.creditLimitCents)}` : ""}`}
                {application.accountStatus === "rejected" && details.rejectedReason && ` · ${details.rejectedReason}`}
              </span>
            </div>
            {isOpen && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => setDeciding({ application, action: "approve" })}>
                  Approve
                </Button>
                <Button size="sm" onClick={() => setDeciding({ application, action: "reject" })}>
                  Reject
                </Button>
                {application.accountStatus === "pending" && (
                  <Button size="sm" variant="ghost" onClick={() => setDeciding({ application, action: "hold" })}>
                    Put on hold
                  </Button>
                )}
              </div>
            )}
          </article>
        );
      })}
      {deciding?.action === "approve" && (
        <ApproveDialog
          application={deciding.application}
          onSaved={() => done(`${deciding.application.accountName} now pays on a 30-day account.`)}
          onClose={() => setDeciding(null)}
        />
      )}
      {deciding?.action === "reject" && (
        <AdminPromptDialog
          title={`Reject ${deciding.application.accountName}`}
          description="The organisation stays on card and is asked to add one. The reason is shown to its admins."
          confirmLabel="Reject application"
          confirmVariant="danger"
          fields={[{ name: "reason", label: "Reason (shown to the organisation)" }]}
          onConfirm={async ({ reason }) => {
            await rejectApplicationRequest(requireAccessToken(), deciding.application.billingAccountId, String(reason));
            done(`${deciding.application.accountName}'s application was rejected.`);
          }}
          onClose={() => setDeciding(null)}
        />
      )}
      {deciding?.action === "hold" && (
        <AdminPromptDialog
          title={`Put ${deciding.application.accountName} on hold`}
          description="Tell the organisation what you need. Nothing is blocked in the meantime."
          confirmLabel="Put on hold"
          fields={[{ name: "reason", label: "What's needed (shown to the organisation)" }]}
          onConfirm={async ({ reason }) => {
            await holdApplicationRequest(requireAccessToken(), deciding.application.billingAccountId, String(reason));
            done(`${deciding.application.accountName}'s application is on hold.`);
          }}
          onClose={() => setDeciding(null)}
        />
      )}
    </div>
  );
};
