"use client";

import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { ModelComponent, ModelSystem } from "@/lib/types/machineLibrary";
import type { ModelTreeActions } from "../useModelTree";
import { TreeNodeNameModal } from "./treeNodeNameModal";
import { ImportTreeModal } from "./importTreeModal";

export type TreeDialog =
  | { kind: "addSystem" }
  | { kind: "import" }
  | { kind: "addComponent"; system: ModelSystem }
  | { kind: "renameSystem"; system: ModelSystem }
  | { kind: "deleteSystem"; system: ModelSystem }
  | { kind: "renameComponent"; component: ModelComponent }
  | { kind: "deleteComponent"; component: ModelComponent };

interface SystemTreeDialogsProps {
  dialog: TreeDialog;
  modelName: string;
  actions: ModelTreeActions;
  onClose: () => void;
}

const toDeleteErrorMessage = (error: unknown) => toApiErrorMessage(error, "Couldn't delete. Please try again.");

export const SystemTreeDialogs = ({ dialog, modelName, actions, onClose }: SystemTreeDialogsProps) => {
  switch (dialog.kind) {
    case "addSystem":
      return (
        <TreeNodeNameModal
          title={`Add system — ${modelName}`}
          fieldLabel="System name"
          submitLabel="Add system"
          placeholder="Hydraulics"
          onSubmit={actions.addSystem}
          onClose={onClose}
        />
      );
    case "import":
      return <ImportTreeModal modelName={modelName} onImport={actions.importTree} onClose={onClose} />;
    case "addComponent":
      return (
        <TreeNodeNameModal
          title={`Add component — ${dialog.system.name}`}
          fieldLabel="Component name"
          submitLabel="Add component"
          placeholder="Torque converter"
          onSubmit={(name) => actions.addComponent(dialog.system.id, name)}
          onClose={onClose}
        />
      );
    case "renameSystem":
      return (
        <TreeNodeNameModal
          title="Rename system"
          fieldLabel="System name"
          submitLabel="Save"
          initialName={dialog.system.name}
          onSubmit={(name) => actions.renameSystem(dialog.system.id, name)}
          onClose={onClose}
        />
      );
    case "renameComponent":
      return (
        <TreeNodeNameModal
          title="Rename component"
          fieldLabel="Component name"
          submitLabel="Save"
          initialName={dialog.component.name}
          onSubmit={(name) => actions.renameComponent(dialog.component.id, name)}
          onClose={onClose}
        />
      );
    case "deleteSystem":
      return (
        <ConfirmDialog
          title="Delete system"
          confirmLabel="Delete system"
          toErrorMessage={toDeleteErrorMessage}
          onConfirm={() => actions.deleteSystem(dialog.system.id)}
          onClose={onClose}
        >
          Delete <strong>{dialog.system.name}</strong> and its {dialog.system.componentCount} components from{" "}
          {modelName}? Every asset of this model stops showing them.
        </ConfirmDialog>
      );
    case "deleteComponent":
      return (
        <ConfirmDialog
          title="Delete component"
          confirmLabel="Delete component"
          toErrorMessage={toDeleteErrorMessage}
          onConfirm={() => actions.deleteComponent(dialog.component.id)}
          onClose={onClose}
        >
          Delete <strong>{dialog.component.name}</strong> from {modelName}?
        </ConfirmDialog>
      );
  }
};
