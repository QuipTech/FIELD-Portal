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

export const MachineSpecList = () => {
  const { machine, notify, notifyError } = useMachineDetail();
  if (!machine) return <SkeletonBar className="h-[218px] min-w-[280px] flex-1 rounded-xl" />;

  const copySerial = () =>
    navigator.clipboard
      .writeText(machine.serialNumber)
      .then(() => notify("Serial number copied"))
      .catch(() => notifyError("Couldn't copy the serial number."));

  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-borderGray bg-surface px-3.5">
      <SpecRow
        label="Serial"
        value={<span className="font-mono">{machine.serialNumber}</span>}
        aside={
          <button
            type="button"
            onClick={copySerial}
            className="rounded-md border border-borderGrayStrong bg-fillGray px-2 py-0.5 text-xs text-bodyGray hover:text-ink"
          >
            Copy
          </button>
        }
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
