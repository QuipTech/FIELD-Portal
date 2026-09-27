"use client";

import { useState } from "react";
import { Tag } from "@/components/ui/tag";
import { machineModels } from "@/lib/mockData/adminMachineLibrary";

export const ModelsList = () => {
  const [selectedId, setSelectedId] = useState(machineModels[0]?.id);

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Models</span>
      {machineModels.map((model) => {
        const selected = model.id === selectedId;
        return (
          <button
            key={model.id}
            onClick={() => setSelectedId(model.id)}
            className={`flex flex-col gap-1.5 rounded-xl border p-3.5 text-left ${
              selected ? "border-primaryBorder bg-primaryTint" : "border-borderGray bg-surface"
            }`}
          >
            <div className="flex items-center">
              <span className="text-[15px] text-ink">{model.name}</span>
              <Tag tone={selected ? "primary" : "default"} className="ml-auto">
                {model.systemsCount} systems
              </Tag>
            </div>
            <span className="text-xs text-mutedGray">{model.assetsCount} assets · {model.category}</span>
          </button>
        );
      })}
    </div>
  );
};
