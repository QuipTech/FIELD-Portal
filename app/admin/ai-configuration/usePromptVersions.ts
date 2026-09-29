"use client";

import { useState } from "react";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import {
  createPromptVersionRequest,
  getPromptVersionRequest,
  listPromptVersionsRequest,
  publishPromptVersionRequest,
  testPromptRequest,
} from "@/lib/api/aiConfigurationApi";

const LIST_FAILED_MESSAGE = "Couldn't load prompt versions. Please try again.";
const VERSION_FAILED_MESSAGE = "Couldn't load this prompt version. Please try again.";

// The platform-wide assistant prompt: its versions, the one being viewed
// (the live one until another is picked), and saving/publishing/testing.
export const usePromptVersions = () => {
  const versions = useApiResource(listPromptVersionsRequest, [], LIST_FAILED_MESSAGE);
  const [pickedVersionId, setPickedVersionId] = useState<string | null>(null);
  const versionList = versions.data ?? [];
  const selectedSummary =
    versionList.find((version) => version.id === pickedVersionId) ??
    versionList.find((version) => version.isLive) ??
    versionList[0] ??
    null;
  const selectedId = selectedSummary?.id ?? null;
  const selected = useApiResource(
    async (accessToken) => (selectedId ? getPromptVersionRequest(accessToken, selectedId) : null),
    [selectedId],
    VERSION_FAILED_MESSAGE,
  );

  // Each rejects with the API's error so the calling dialog can show it.
  const saveVersion = async (body: string, notes: string) => {
    const created = await createPromptVersionRequest(requireAccessToken(), { body, notes: notes || undefined });
    setPickedVersionId(created.id);
    versions.reload();
  };

  const publishVersion = async (versionId: string) => {
    await publishPromptVersionRequest(requireAccessToken(), versionId);
    versions.reload();
    selected.reload();
  };

  const testPrompt = (body: string, question: string) => testPromptRequest(requireAccessToken(), { body, question });

  return {
    versions: versionList,
    isLoading: versions.isLoading,
    loadError: versions.error,
    selectedSummary,
    selectedVersion: selected.data?.id === selectedId ? selected.data : null,
    selectVersion: setPickedVersionId,
    saveVersion,
    publishVersion,
    testPrompt,
  };
};

export type PromptVersionsState = ReturnType<typeof usePromptVersions>;
