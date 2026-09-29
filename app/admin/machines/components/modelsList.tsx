"use client";

import { Tag } from "@/components/ui/tag";
import type { MachineModelSummary } from "@/lib/types/machineLibrary";

interface ModelsListProps {
  models: MachineModelSummary[];
  selectedModelId: string | null;
  isSearching: boolean;
  onSelect: (modelId: string) => void;
}

export const ModelsList = ({ models, selectedModelId, isSearching, onSelect }: ModelsListProps) => {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Models</span>
      {models.length === 0 && (
        <span className="py-6 text-sm text-mutedGray">
          {isSearching ? "No models match your search." : "No models yet. Add one with New model."}
        </span>
      )}
      {models.map((model) => {
        const selected = model.id === selectedModelId;
        return (
          <button
            key={model.id}
            onClick={() => onSelect(model.id)}
            className={`flex flex-col gap-1.5 rounded-xl border p-3.5 text-left ${
              selected ? "border-primaryBorder bg-primaryTint" : "border-borderGray bg-surface"
            }`}
          >
            <div className="flex items-center">
              <span className="text-[15px] text-ink">{model.displayName}</span>
              <Tag tone={selected ? "primary" : "default"} className="ml-auto">
                {model.systemsCount} {model.systemsCount === 1 ? "system" : "systems"}
              </Tag>
            </div>
            <span className="text-xs text-mutedGray">
              {model.assetsCount} {model.assetsCount === 1 ? "asset" : "assets"}
              {model.category ? ` · ${model.category}` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
};
