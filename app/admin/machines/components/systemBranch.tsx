"use client";

import { Icon } from "@/components/icons/icon";
import { ActionMenu } from "@/components/ui/actionMenu";
import type { ModelComponent, ModelSystem } from "@/lib/types/machineLibrary";
import type { TreeDialog } from "./systemTreeDialogs";

interface SystemBranchProps {
  system: ModelSystem;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenDialog: (dialog: TreeDialog) => void;
  // False for a shared model viewed by an Owner: the tree is read-only.
  isEditable: boolean;
}

export const SystemBranch = ({ system, isExpanded, onToggle, onOpenDialog, isEditable }: SystemBranchProps) => {
  const componentMenuItems = (component: ModelComponent) => [
    { label: "Rename", icon: "file" as const, onSelect: () => onOpenDialog({ kind: "renameComponent", component }) },
    {
      label: "Delete",
      icon: "x" as const,
      tone: "danger" as const,
      onSelect: () => onOpenDialog({ kind: "deleteComponent", component }),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button onClick={onToggle} aria-expanded={isExpanded} className="flex flex-1 items-center gap-2">
          <Icon name={isExpanded ? "chevd" : "chevr"} className="stroke-bodyGray" />
          <span className="text-[15px] font-medium text-ink">{system.name}</span>
          <span className="ml-auto text-xs text-mutedGray">
            {system.componentCount} {system.componentCount === 1 ? "component" : "components"}
          </span>
        </button>
        {isEditable && (
          <ActionMenu
            label={system.name}
            items={[
              { label: "Add component", icon: "plus", onSelect: () => onOpenDialog({ kind: "addComponent", system }) },
              { label: "Rename", icon: "file", onSelect: () => onOpenDialog({ kind: "renameSystem", system }) },
              { label: "Delete", icon: "x", tone: "danger", onSelect: () => onOpenDialog({ kind: "deleteSystem", system }) },
            ]}
          />
        )}
      </div>
      {isExpanded && (
        <div className="flex flex-col gap-1 pl-[26px]">
          {system.components.length === 0 && (
            <span className="text-xs text-mutedGray">
              {isEditable ? "No components yet. Add one from the ⋯ menu." : "No components yet."}
            </span>
          )}
          {system.components.map((component) => (
            <div key={component.id} className="flex items-center gap-2">
              <Icon name="layers" className="h-3.5 w-3.5 stroke-mutedGray" />
              <span className="text-[15px] text-bodyGray">{component.name}</span>
              {isEditable && (
                <div className="ml-auto">
                  <ActionMenu label={component.name} items={componentMenuItems(component)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
