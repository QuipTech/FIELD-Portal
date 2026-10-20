"use client";

import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format/nameInitials";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { useMachineDetail } from "../machineDetailContext";

const readingFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

// "Read 19 Mar 06:00".
const formatReadAt = (isoDate: string) => `Read ${readingFormat.format(new Date(isoDate)).replace(",", "")}`;

const SpecRow = ({ label, value, aside }: { label: string; value: ReactNode; aside?: ReactNode }) => (
  <div className="flex items-center gap-3 border-b border-borderGray py-2.5 last:border-b-0">
    <span className="w-24 flex-none text-xs font-medium uppercase tracking-wide text-mutedGray">{label}</span>
    <span className="min-w-0 truncate text-[15px] text-ink">{value}</span>
    {aside && <span className="ml-auto flex flex-none items-center gap-1 text-xs text-mutedGray">{aside}</span>}
  </div>
);

// Copies `value`, confirming with a toast named after `what`.
const CopyButton = ({ value, what }: { value: string; what: string }) => {
  const { notify, notifyError } = useMachineDetail();
  const copy = () =>
    navigator.clipboard
      .writeText(value)
      .then(() => notify(`${what} copied`))
      .catch(() => notifyError(`Couldn't copy the ${what.toLowerCase()}.`));
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${what.toLowerCase()}`}
      className="rounded-md border border-borderGrayStrong bg-fillGray px-2 py-0.5 text-xs text-bodyGray hover:text-ink"
    >
      Copy
    </button>
  );
};

export const MachineSpecList = () => {
  const { machine } = useMachineDetail();
  if (!machine) return <SkeletonBar className="h-[260px] min-w-[280px] flex-1 rounded-xl" />;

  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-borderGray bg-surface px-3.5">
      <SpecRow
        label="Plant ID"
        value={machine.plantId ? <span className="font-mono">{machine.plantId}</span> : "—"}
        aside={machine.plantId && <CopyButton value={machine.plantId} what="Plant ID" />}
      />
      <SpecRow
        label="Serial"
        value={<span className="font-mono">{machine.serialNumber}</span>}
        aside={<CopyButton value={machine.serialNumber} what="Serial number" />}
      />
      <SpecRow
        label="Hours"
        value={machine.operatingHours === null ? "—" : `${machine.operatingHours.toLocaleString()} h`}
        aside={machine.hoursReadAt && formatReadAt(machine.hoursReadAt)}
      />
      <SpecRow label="Site" value={machine.site ?? "—"} />
      <SpecRow
        label="Owner"
        value={machine.owner?.name ?? "Unassigned"}
        aside={machine.owner && <Avatar initials={getInitials(machine.owner.name)} imageSrc={machine.owner.avatarUrl ?? undefined} size="sm" />}
      />
    </div>
  );
};
