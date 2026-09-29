"use client";

import { useEffect, useState } from "react";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { createMachineModelRequest, listMachineModelsRequest } from "@/lib/api/machineLibraryApi";
import type { CreateMachineModelPayload, MachineModelSummary } from "@/lib/types/machineLibrary";

const LOAD_FAILED_MESSAGE = "Couldn't load machine models. Please try again.";
const SEARCH_DEBOUNCE_MS = 250;

const byDisplayName = (a: MachineModelSummary, b: MachineModelSummary) =>
  a.displayName.localeCompare(b.displayName);

export const useMachineModels = () => {
  const [search, setSearch] = useState("");
  const [models, setModels] = useState<MachineModelSummary[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const loadModels = async () => {
      const loaded = await listMachineModelsRequest(requireAccessToken(), search.trim());
      if (!isCurrent) return;
      setModels(loaded);
      setLoadError(null);
      // Keep the selection while it's still in the results.
      setSelectedModelId((current) =>
        loaded.some((model) => model.id === current) ? current : (loaded[0]?.id ?? null),
      );
    };
    const timer = setTimeout(() => {
      loadModels()
        .catch((error: unknown) => isCurrent && setLoadError(toApiErrorMessage(error, LOAD_FAILED_MESSAGE)))
        .finally(() => isCurrent && setIsLoading(false));
    }, search ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [search]);

  // Rejects with the API's error so the calling form can show it.
  const createModel = async (payload: CreateMachineModelPayload) => {
    const created = await createMachineModelRequest(requireAccessToken(), payload);
    setModels((current) => [...current, created].sort(byDisplayName));
    setSelectedModelId(created.id);
  };

  const updateSystemsCount = (modelId: string, systemsCount: number) =>
    setModels((current) => current.map((model) => (model.id === modelId ? { ...model, systemsCount } : model)));

  return {
    search,
    setSearch,
    models,
    selectedModel: models.find((model) => model.id === selectedModelId) ?? null,
    selectModel: setSelectedModelId,
    isLoading,
    loadError,
    createModel,
    updateSystemsCount,
  };
};
