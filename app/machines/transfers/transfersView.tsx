"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Tag } from "@/components/ui/tag";
import type { Tone } from "@/components/ui/tone";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { useSignedInProfile } from "@/lib/auth/useSignedInProfile";
import { decideTransferRequest, listTransfersRequest } from "@/lib/api/machineLifecycleApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { MachineTransfer, TransferStatus } from "@/lib/types/machineLifecycle";

const STATUS: Record<TransferStatus, { label: string; tone: Tone }> = {
  requested: { label: "Waiting for approval", tone: "amber" },
  completed: { label: "Completed", tone: "ok" },
  rejected: { label: "Rejected", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "default" },
};

type Decision = { transfer: MachineTransfer; decision: "approve" | "reject" | "cancel" };

const DECISION_COPY = {
  approve: {
    title: "Approve transfer",
    confirm: "Approve and receive machine",
    body: "The machine and its components and configuration move to your organisation as registered: free until you activate it. The seller's history, work orders, photos and notes stay with them.",
  },
  reject: { title: "Reject transfer", confirm: "Reject", body: "The machine stays with the seller." },
  cancel: { title: "Cancel transfer request", confirm: "Cancel request", body: "The machine stays with you and keeps billing as it is." },
} as const;

// Machine sales between organisations (billing spec section 4): requests
// to your organisation to approve, and the ones you sent.
export const TransfersView = () => {
  const profile = useSignedInProfile();
  const [direction, setDirection] = useState<"incoming" | "outgoing">("incoming");
  const transfers = useApiResource(
    (accessToken) => listTransfersRequest(accessToken, direction),
    [direction],
    "Couldn't load transfers.",
  );
  const [deciding, setDeciding] = useState<Decision | null>(null);
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-col gap-3.5">
      {profile?.tenant?.slug && (
        <p className="rounded-xl border border-borderGray bg-surface p-4 text-sm text-bodyGray">
          To receive a machine, give the seller your organisation ID:{" "}
          <code className="rounded bg-fillGray px-1.5 py-0.5 text-ink">{profile.tenant.slug}</code>
        </p>
      )}
      <div role="tablist" aria-label="Transfers" className="flex gap-1 border-b border-borderGray">
        {(["incoming", "outgoing"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={direction === tab}
            onClick={() => setDirection(tab)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${direction === tab ? "border-primary font-medium text-ink" : "border-transparent text-bodyGray"}`}
          >
            {tab === "incoming" ? "To approve" : "Sent"}
          </button>
        ))}
      </div>
      {transfers.isLoading && !transfers.data && <span className="flex items-center gap-2 text-sm text-mutedGray"><LoadingSpinner /> Loading transfers…</span>}
      {transfers.error && <p className="text-sm text-danger">{transfers.error}</p>}
      {transfers.data?.length === 0 && <p className="text-sm text-bodyGray">No transfers.</p>}
      {transfers.data?.map((transfer) => (
        <article key={transfer.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-borderGray bg-surface p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium text-ink">
              {transfer.machine.label} · {transfer.machine.manufacturer} {transfer.machine.model}
            </span>
            <span className="text-sm text-bodyGray">
              {direction === "incoming" ? `From ${transfer.fromOrganisation.name}` : `To ${transfer.toOrganisation.name}`} · Serial {transfer.machine.serialNumber} · {transfer.reason}
            </span>
            {transfer.decisionNote && <span className="text-xs text-mutedGray">Note: {transfer.decisionNote}</span>}
          </div>
          <Tag tone={STATUS[transfer.status].tone}>{STATUS[transfer.status].label}</Tag>
          {transfer.status === "requested" && direction === "incoming" && (
            <>
              <Button size="sm" variant="primary" onClick={() => setDeciding({ transfer, decision: "approve" })}>Approve</Button>
              <Button size="sm" onClick={() => setDeciding({ transfer, decision: "reject" })}>Reject</Button>
            </>
          )}
          {transfer.status === "requested" && direction === "outgoing" && (
            <Button size="sm" onClick={() => setDeciding({ transfer, decision: "cancel" })}>Cancel request</Button>
          )}
        </article>
      ))}
      {deciding && (
        <ConfirmDialog
          title={DECISION_COPY[deciding.decision].title}
          confirmLabel={DECISION_COPY[deciding.decision].confirm}
          confirmVariant={deciding.decision === "approve" ? "primary" : "danger"}
          onConfirm={async () => {
            await decideTransferRequest(requireAccessToken(), deciding.transfer.id, deciding.decision, note.trim() || undefined);
            setDeciding(null);
            setNote("");
            transfers.reload();
          }}
          onClose={() => { setDeciding(null); setNote(""); }}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't save that decision. Please try again.")}
        >
          <div className="flex flex-col gap-3">
            <p>{DECISION_COPY[deciding.decision].body}</p>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Note (optional)
              <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} className="h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink outline-none" />
            </label>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
};
