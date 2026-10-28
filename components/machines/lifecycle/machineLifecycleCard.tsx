"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { getMachineLifecycleRequest } from "@/lib/api/machineLifecycleApi";
import type { LifecycleChangeResult, LifecycleState } from "@/lib/types/machineLifecycle";
import { LifecycleActionDialog } from "./lifecycleActionDialog";
import { TransferRequestDialog } from "./transferRequestDialog";

const STATE_LABELS: Record<string, string> = {
  registered: "Registered",
  active: "Active",
  archived: "Archived",
  sold: "Sold / transferred",
};

const describeChange = (fromState: string, toState: string) =>
  `${STATE_LABELS[fromState] ?? fromState} → ${STATE_LABELS[toState] ?? toState}`;

interface MachineLifecycleCardProps {
  machineId: string;
  machineLabel: string;
  lifecycleState: LifecycleState;
  onChanged: (result: LifecycleChangeResult) => void;
}

// Billing lifecycle for one machine (machine.lifecycle): take it out of
// active, sell or transfer it, and every change so far with who made it.
// Activating and reactivating stay on the banner above.
export const MachineLifecycleCard = ({ machineId, machineLabel, lifecycleState, onChanged }: MachineLifecycleCardProps) => {
  const { can } = usePermissions();
  const lifecycle = useApiResource(
    (accessToken) => getMachineLifecycleRequest(accessToken, machineId),
    [machineId, lifecycleState],
    "Couldn't load this machine's lifecycle.",
  );
  const [dialog, setDialog] = useState<"deactivate" | "archive" | "transfer" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (!can(PERMISSIONS.manageMachineLifecycle)) return null;
  const actions = lifecycle.data?.availableActions ?? [];

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-borderGray bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-medium text-ink">Lifecycle and billing</h2>
        <Tag tone={lifecycleState === "active" ? "primary" : "default"}>{STATE_LABELS[lifecycleState]}</Tag>
        <div className="ml-auto flex flex-wrap gap-2">
          {actions.includes("deactivate") && <Button size="sm" onClick={() => setDialog("deactivate")}>Deactivate</Button>}
          {actions.includes("archive") && <Button size="sm" onClick={() => setDialog("archive")}>Archive</Button>}
          {lifecycle.data?.canRequestTransfer && <Button size="sm" onClick={() => setDialog("transfer")}>Sell or transfer</Button>}
        </div>
      </div>
      {notice && <p role="status" className="text-sm text-bodyGray">{notice}</p>}
      {lifecycle.error && <p className="text-sm text-danger">{lifecycle.error}</p>}
      {lifecycle.data && lifecycle.data.events.length > 0 && (
        <ol className="flex flex-col gap-1.5 text-sm">
          {lifecycle.data.events.slice(0, 8).map((event) => (
            <li key={event.id} className="flex flex-wrap gap-x-2 text-bodyGray">
              <span className="text-ink">{describeChange(event.fromState, event.toState)}</span>
              <span>{new Date(event.occurredAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
              {event.actorName && <span>· {event.actorName}</span>}
              {event.reason && <span>· {event.reason}</span>}
            </li>
          ))}
        </ol>
      )}
      {dialog === "deactivate" || dialog === "archive" ? (
        <LifecycleActionDialog
          machineId={machineId}
          machineLabel={machineLabel}
          action={dialog}
          onDone={(result) => { setDialog(null); onChanged(result); }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "transfer" && (
        <TransferRequestDialog
          machineId={machineId}
          machineLabel={machineLabel}
          onRequested={() => { setDialog(null); setNotice("Transfer requested. The receiving organisation needs to approve it under Machines → Transfers."); }}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
};
