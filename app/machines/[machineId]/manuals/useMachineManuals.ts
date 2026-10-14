"use client";

import { useApiResource } from "@/lib/hooks/useApiResource";
import { searchKnowledgeLibraryRequest } from "@/lib/api/knowledgeLibraryApi";
import type { KnowledgeLibraryResults } from "@/lib/types/knowledgeLibrary";

const NO_RESULTS: KnowledgeLibraryResults = { items: [], total: 0, searchMode: "browse", makes: [], activeModel: null };

// The knowledge library's documents for one machine model, newest first.
// Nothing to load until the machine (and so its model) is known.
export const useMachineManuals = (modelId: string | null) =>
  useApiResource(
    (accessToken) =>
      modelId
        ? searchKnowledgeLibraryRequest(accessToken, { search: "", type: "", make: "", model: modelId, sort: "newest" })
        : Promise.resolve(NO_RESULTS),
    [modelId],
    "Couldn't load this machine's manuals. Please try again.",
  );
