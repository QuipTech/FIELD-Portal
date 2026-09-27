"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/searchSelect";
import { machineComponentOptions } from "@/lib/mockData/machineComponentOptions";
import type { HistoryEntryType } from "@/lib/types/historyEntry";

const entryTypes: HistoryEntryType[] = ["Repair", "Inspection", "Fault", "Service"];

interface AddEntryModalProps {
  machineId: string;
  hours: number;
  onClose: () => void;
}

export const AddEntryModal = ({ machineId, hours, onClose }: AddEntryModalProps) => {
  const [selectedType, setSelectedType] = useState<HistoryEntryType>("Repair");
  const [componentAffected, setComponentAffected] = useState("");

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-inkStatic/40">
      <div className="flex max-h-[90vh] w-[520px] flex-col overflow-y-auto rounded-2xl bg-surface">
        <div className="flex h-14 flex-none items-center border-b border-borderGray px-4">
          <span className="text-[15px] font-medium text-ink">New history entry — {machineId}</span>
          <button onClick={onClose} className="ml-auto text-bodyGray">
            <Icon name="x" />
          </button>
        </div>
        <div className="flex flex-col gap-3.5 p-5">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Entry type</span>
            <div className="flex gap-2">
              {entryTypes.map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant={selectedType === type ? "primary" : "default"}
                  onClick={() => setSelectedType(type)}
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Component affected</span>
            <SearchSelect
              options={machineComponentOptions}
              value={componentAffected}
              onChange={setComponentAffected}
              placeholder="Hydraulics › Main pump"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">What happened</span>
            <textarea
              rows={3}
              placeholder="Describe the fault, what you did and how you verified it…"
              className="resize-none rounded-lg border border-borderGrayStrong bg-surface p-3 text-[15px] text-ink outline-none placeholder:text-mutedGray"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Media</span>
            <div className="flex gap-2">
              <button className="flex h-[66px] w-[84px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-borderGrayStrong text-[11px] text-mutedGray">
                <Icon name="camera" className="h-[22px] w-[22px]" />
                Add photo
              </button>
              <div className="flex h-[66px] w-[84px] items-center justify-center rounded-lg border border-borderGrayStrong bg-fillGray text-mutedGray">
                <Icon name="image" className="h-[22px] w-[22px]" />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Hours</span>
              <Input defaultValue={hours.toLocaleString()} />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Downtime</span>
              <Input placeholder="3.5 h" />
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-mutedGray">
            <Icon name="cloud" className="h-3.5 w-3.5" /> Saved offline — syncs when back in range
          </span>
          <div className="flex">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" className="ml-auto" onClick={onClose}>
              <Icon name="check" />
              Save entry
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
