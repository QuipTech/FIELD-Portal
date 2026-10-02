"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import type { MachineModelSummary } from "@/lib/types/machineLibrary";
import { useModelTree } from "../useModelTree";
import { SystemBranch } from "./systemBranch";
import { SystemTreeDialogs, type TreeDialog } from "./systemTreeDialogs";

// Render with key={model.id} so switching models starts from a fresh state.
interface SystemTreeProps {
  model: MachineModelSummary;
  onSystemsCountChange: (modelId: string, systemsCount: number) => void;
}

export const SystemTree = ({ model, onSystemsCountChange }: SystemTreeProps) => {
  const { tree, isLoading, loadError, ...actions } = useModelTree(model.id, onSystemsCountChange);
  // undefined until the tree first loads, then the first system opens.
  const [expandedSystemId, setExpandedSystemId] = useState<string | null | undefined>(undefined);
  const [dialog, setDialog] = useState<TreeDialog | null>(null);

  useEffect(() => {
    if (tree && expandedSystemId === undefined) setExpandedSystemId(tree.systems[0]?.id ?? null);
  }, [tree, expandedSystemId]);

  return (
    <div className="flex flex-col gap-3.5">
      <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
        System &amp; component tree — {model.displayName}
      </span>
      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-mutedGray">
          <LoadingSpinner /> Loading systems…
        </div>
      )}
      {loadError && <span className="py-6 text-sm text-danger">{loadError}</span>}
      {tree && (
        <div className="flex flex-col gap-3">
          {tree.systems.length === 0 && (
            <span className="text-sm text-mutedGray">No systems yet. Add one or import a tree.</span>
          )}
          {tree.systems.map((system) => (
            <SystemBranch
              key={system.id}
              system={system}
              isExpanded={system.id === expandedSystemId}
              onToggle={() => setExpandedSystemId(system.id === expandedSystemId ? null : system.id)}
              onOpenDialog={setDialog}
              isEditable={model.isEditable}
            />
          ))}
        </div>
      )}
      {!model.isEditable && (
        <span className="text-xs text-mutedGray">
          Shared QuipTech model — read-only. Add your own model to customise its systems.
        </span>
      )}
      <div className={`gap-2.5 ${model.isEditable ? "flex" : "hidden"}`}>
        <Button onClick={() => setDialog({ kind: "addSystem" })} disabled={!tree}>
          <Icon name="plus" />
          Add system
        </Button>
        <Button onClick={() => setDialog({ kind: "import" })} disabled={!tree}>
          <Icon name="upload" />
          Import tree
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-400">Reused by every asset instance of the model.</p>
      {dialog && (
        <SystemTreeDialogs dialog={dialog} modelName={model.displayName} actions={actions} onClose={() => setDialog(null)} />
      )}
    </div>
  );
};
