"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { useMachineModels } from "../useMachineModels";
import { ModelsList } from "./modelsList";
import { SystemTree } from "./systemTree";
import { NewModelModal } from "./newModelModal";

export const MachineLibraryManager = () => {
  const { search, setSearch, models, selectedModel, selectModel, isLoading, loadError, createModel, updateSystemsCount } =
    useMachineModels();
  const [isNewModelOpen, setIsNewModelOpen] = useState(false);

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
          />
          {selectedModel && <SystemTree key={selectedModel.id} model={selectedModel} onSystemsCountChange={updateSystemsCount} />}
        </div>
      )}
      {isNewModelOpen && <NewModelModal onCreate={createModel} onClose={() => setIsNewModelOpen(false)} />}
    </>
  );
};
