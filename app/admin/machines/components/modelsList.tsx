"use client";

import { Tag } from "@/components/ui/tag";
import { ActionMenu } from "@/components/ui/actionMenu";
import { OwnershipTag } from "@/components/admin/ownershipTag";
import type { MachineModelSummary } from "@/lib/types/machineLibrary";

interface ModelsListProps {
  models: MachineModelSummary[];
  selectedModelId: string | null;
  isSearching: boolean;
  onSelect: (modelId: string) => void;
  onDelete: (model: MachineModelSummary) => void;
}

export const ModelsList = ({ models, selectedModelId, isSearching, onSelect, onDelete }: ModelsListProps) => {
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
          // The menu sits beside the select button, not inside it: buttons can't nest.
          <div
            key={model.id}
            className={`flex items-start gap-1 rounded-xl border pr-1.5 ${
              selected ? "border-primaryBorder bg-primaryTint" : "border-borderGray bg-surface"
            }`}
          >
            <button onClick={() => onSelect(model.id)} className="flex flex-1 flex-col gap-1.5 p-3.5 text-left">
              <div className="flex w-full items-center">
                <span className="text-[15px] text-ink">{model.displayName}</span>
                <Tag tone={selected ? "primary" : "default"} className="ml-auto">
                  {model.systemsCount} {model.systemsCount === 1 ? "system" : "systems"}
                </Tag>
              </div>
              <div className="flex w-full items-center gap-2">
                <span className="text-xs text-mutedGray">
                  {model.assetsCount} {model.assetsCount === 1 ? "asset" : "assets"}
                  {model.category ? ` · ${model.category}` : ""}
                </span>
                <span className="ml-auto">
                  <OwnershipTag organisationName={model.organisation?.name ?? null} />
                </span>
              </div>
            </button>
            {model.isEditable && (
              <div className="pt-2.5">
                <ActionMenu
                  label={model.displayName}
                  items={[{ label: "Delete model", icon: "x", tone: "danger", onSelect: () => onDelete(model) }]}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
