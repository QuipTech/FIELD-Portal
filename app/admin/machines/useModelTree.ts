"use client";

import { useEffect, useState } from "react";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import {
  addModelComponentRequest,
  addModelSystemRequest,
  deleteModelComponentRequest,
  deleteModelSystemRequest,
  getModelTreeRequest,
  importModelTreeRequest,
  renameModelComponentRequest,
  renameModelSystemRequest,
} from "@/lib/api/machineLibraryApi";
import type { ImportModelTreePayload, ModelSystemTree } from "@/lib/types/machineLibrary";

const LOAD_FAILED_MESSAGE = "Couldn't load this model's systems. Please try again.";

// The selected model's system & component tree. Every change resolves to
// the refreshed tree; onSystemsCountChange keeps the models list in step.
export const useModelTree = (
  modelId: string | null,
  onSystemsCountChange: (modelId: string, systemsCount: number) => void,
) => {
  const [tree, setTree] = useState<ModelSystemTree | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setTree(null);
    setLoadError(null);
    if (!modelId) return;
    let isCurrent = true;
    const loadTree = async () => {
      const loaded = await getModelTreeRequest(requireAccessToken(), modelId);
      if (isCurrent) setTree(loaded);
    };
    setIsLoading(true);
    loadTree()
      .catch((error: unknown) => isCurrent && setLoadError(toApiErrorMessage(error, LOAD_FAILED_MESSAGE)))
      .finally(() => isCurrent && setIsLoading(false));
    return () => {
      isCurrent = false;
    };
  }, [modelId]);

  // Rejects with the API's error so the calling dialog can show it.
  const applyTreeChange = async (sendChange: (accessToken: string) => Promise<ModelSystemTree>) => {
    const updated = await sendChange(requireAccessToken());
    setTree(updated);
    onSystemsCountChange(updated.modelId, updated.systems.length);
  };

  return {
    tree,
    isLoading,
    loadError,
    addSystem: (name: string) =>
      applyTreeChange((token) => addModelSystemRequest(token, modelId ?? "", name)),
    importTree: (payload: ImportModelTreePayload) =>
      applyTreeChange((token) => importModelTreeRequest(token, modelId ?? "", payload)),
    renameSystem: (systemId: string, name: string) =>
      applyTreeChange((token) => renameModelSystemRequest(token, systemId, name)),
    deleteSystem: (systemId: string) => applyTreeChange((token) => deleteModelSystemRequest(token, systemId)),
    addComponent: (systemId: string, name: string) =>
      applyTreeChange((token) => addModelComponentRequest(token, systemId, name)),
    renameComponent: (componentId: string, name: string) =>
      applyTreeChange((token) => renameModelComponentRequest(token, componentId, name)),
    deleteComponent: (componentId: string) =>
      applyTreeChange((token) => deleteModelComponentRequest(token, componentId)),
  };
};

export type ModelTreeActions = Omit<ReturnType<typeof useModelTree>, "tree" | "isLoading" | "loadError">;
