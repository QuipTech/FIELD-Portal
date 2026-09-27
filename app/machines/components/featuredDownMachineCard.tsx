import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import type { Machine } from "@/lib/types/machine";

interface FeaturedDownMachineCardProps {
  machine: Machine;
  fault: string;
  caseId: string;
}

export const FeaturedDownMachineCard = ({ machine, fault, caseId }: FeaturedDownMachineCardProps) => {
  return (
    <div className="flex flex-none items-center gap-[18px] rounded-xl border border-dangerBorder bg-dangerTint p-3.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- local SVG asset, next/image blocks SVG optimization by default */}
      <img
        src="/images/image-slot-5.svg"
        alt={`${machine.id} thumbnail`}
        className="h-[74px] w-28 flex-none rounded-lg object-cover"
      />
      <div className="flex flex-none flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[17px] font-medium text-ink">{machine.id}</span>
          <Tag tone="danger">Down</Tag>
        </div>
        <span className="text-xs text-mutedGray">
          {machine.model} · {machine.site} · {machine.hours.toLocaleString()} h
        </span>
      </div>
      <div className="ml-4 flex flex-none flex-col gap-0.5">
        <span className="text-xs text-mutedGray">Fault</span>
        <span className="text-[15px] font-medium text-ink">{fault}</span>
      </div>
      <div className="flex flex-none flex-col gap-0.5">
        <span className="text-xs text-mutedGray">Open case</span>
        <span className="text-[15px] font-medium text-ink">#{caseId} · P1</span>
      </div>
      <div className="ml-auto flex flex-none gap-2">
        <Link href={`/machines/${machine.id}/history`}>
          <Button size="sm"><Icon name="history" className="h-3.5 w-3.5" />History</Button>
        </Link>
        <Link href={`/cases/${caseId}`}>
          <Button variant="primary" size="sm">Open case</Button>
        </Link>
      </div>
    </div>
  );
};
