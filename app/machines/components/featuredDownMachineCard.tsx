import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { LinkButton } from "@/components/ui/linkButton";
import type { FeaturedDownMachine } from "@/lib/types/machineFleet";

// Flags a down machine above the list, with its most urgent open case.
export const FeaturedDownMachineCard = ({ featured }: { featured: FeaturedDownMachine }) => {
  const { machine, openCase } = featured;
  const details = [
    `${machine.manufacturer} ${machine.model}`,
    machine.site,
    machine.operatingHours === null ? null : `${machine.operatingHours.toLocaleString()} h`,
  ].filter(Boolean);

  return (
    <div className="flex flex-none flex-wrap items-center gap-[18px] rounded-xl border border-dangerBorder bg-dangerTint p-3.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- local SVG asset, next/image blocks SVG optimization by default */}
      <img
        src="/images/image-slot-5.svg"
        alt={`${machine.label} thumbnail`}
        className="h-[74px] w-28 flex-none rounded-lg object-cover"
      />
      <div className="flex flex-none flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[17px] font-medium text-ink">{machine.label}</span>
          <Tag tone="danger">Down</Tag>
        </div>
        <span className="text-xs text-mutedGray">{details.join(" · ")}</span>
      </div>
      {openCase ? (
        <>
          <div className="ml-4 flex flex-none flex-col gap-0.5">
            <span className="text-xs text-mutedGray">Fault</span>
            <span className="text-[15px] font-medium text-ink">{openCase.subject}</span>
          </div>
          <div className="flex flex-none flex-col gap-0.5">
            <span className="text-xs text-mutedGray">Open case</span>
            <span className="text-[15px] font-medium text-ink">
              #{openCase.caseNumber} · {openCase.priority}
            </span>
          </div>
        </>
      ) : (
        <span className="ml-4 text-[15px] text-bodyGray">No support case raised yet</span>
      )}
      <div className="ml-auto flex flex-none gap-2">
        <LinkButton href={`/machines/${machine.id}/history`} size="sm">
          <Icon name="history" className="h-3.5 w-3.5" />
          History
        </LinkButton>
        <LinkButton href={openCase ? `/cases/${openCase.caseNumber}` : "/cases"} variant="primary" size="sm">
          {openCase ? "Open case" : "Raise a case"}
        </LinkButton>
      </div>
    </div>
  );
};
