"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { MachineModelSummary } from "@/lib/types/machineLibrary";
import { useMachineModels } from "../useMachineModels";
import { ModelsList } from "./modelsList";
import { SystemTree } from "./systemTree";
import { NewModelModal } from "./newModelModal";

export const MachineLibraryManager = () => {
  const {
    search,
    setSearch,
    models,
    selectedModel,
    selectModel,
    isLoading,
    loadError,
    createModel,
    deleteModel,
    updateSystemsCount,
  } = useMachineModels();
  const [isNewModelOpen, setIsNewModelOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<MachineModelSummary | null>(null);

  return (
    <>
      <div className="flex items-center gap-3">
        <h1 className="text-[22px] font-medium text-ink">Machine library</h1>
        <Input
          icon="search"
          placeholder="Search models"
          className="ml-auto w-56"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button variant="primary" onClick={() => setIsNewModelOpen(true)} disabled={isLoading}>
          <Icon name="plus" />
          New model
        </Button>
      </div>
      {isLoading && (
        <div className="flex items-center gap-2 p-10 text-sm text-mutedGray">
          <LoadingSpinner /> Loading machine library…
        </div>
      )}
      {loadError && <span className="p-10 text-sm text-danger">{loadError}</span>}
      {!isLoading && !loadError && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-2">
          <ModelsList
            models={models}
            selectedModelId={selectedModel?.id ?? null}
            isSearching={Boolean(search.trim())}
            onSelect={selectModel}
            onDelete={setModelToDelete}
          />
          {selectedModel && <SystemTree key={selectedModel.id} model={selectedModel} onSystemsCountChange={updateSystemsCount} />}
        </div>
      )}
      {isNewModelOpen && <NewModelModal onCreate={createModel} onClose={() => setIsNewModelOpen(false)} />}
      {modelToDelete && (
        <ConfirmDialog
          title="Delete model"
          confirmLabel="Delete model"
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't delete the model. Please try again.")}
          onConfirm={() => deleteModel(modelToDelete.id)}
          onClose={() => setModelToDelete(null)}
        >
          Delete <strong>{modelToDelete.displayName}</strong> and its {modelToDelete.systemsCount} systems from the
          machine library? Models still used by machines can&apos;t be deleted.
        </ConfirmDialog>
      )}
    </>
  );
};
