"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/httpClient";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { getKnowledgeArticleRequest } from "@/lib/api/knowledgeArticleApi";
import { getDocumentStatusRequest } from "@/lib/api/documentLifecycleApi";
import { findOfflineArticle } from "@/lib/knowledge/offlineArticleStore";
import type { DocumentStatus } from "@/lib/types/adminDocument";
import type { KnowledgeArticle } from "@/lib/types/knowledgeArticle";

const STATUS_POLL_MS = 4_000;
const LOAD_FAILED_MESSAGE = "Couldn't load this document. Please try again.";

export type ArticleLoadState =
  | { kind: "loading" }
  | { kind: "ready"; article: KnowledgeArticle; isOfflineCopy: boolean }
  | { kind: "notFound" }
  // Not live yet: indexing, queued, failed, awaiting review or archived.
  | { kind: "notLive"; status: DocumentStatus | null }
  | { kind: "error"; message: string };

// No response at all (offline), as opposed to an error the API sent.
const isUnreachable = (error: unknown) => !(error instanceof ApiError) || error.status === 0;

// The article, or why it can't be shown. While the document is indexing
// its status is polled and the article loads as soon as it goes live.
// Offline, a copy saved with "Save offline" is shown instead.
export const useKnowledgeArticle = (documentId: string) => {
  const [state, setState] = useState<ArticleLoadState>({ kind: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      try {
        const article = await getKnowledgeArticleRequest(requireAccessToken(), documentId);
        if (isCurrent) setState({ kind: "ready", article, isOfflineCopy: false });
      } catch (error) {
        if (!isCurrent) return;
        if (error instanceof ApiError && error.status === 404) return setState({ kind: "notFound" });
        if (error instanceof ApiError && error.status === 409) {
          const status = await getDocumentStatusRequest(requireAccessToken(), documentId).catch(() => null);
          return isCurrent && setState({ kind: "notLive", status });
        }
        const saved = isUnreachable(error) ? await findOfflineArticle(documentId).catch(() => null) : null;
        if (!isCurrent) return;
        setState(
          saved
            ? { kind: "ready", article: saved.article, isOfflineCopy: true }
            : { kind: "error", message: toApiErrorMessage(error, LOAD_FAILED_MESSAGE) },
        );
      }
    };
    void load();
    return () => {
      isCurrent = false;
    };
  }, [documentId, reloadCount]);

  // Indexing: check the status until it settles, then load the article.
  const pollingStatus = state.kind === "notLive" ? state.status?.state : null;
  useEffect(() => {
    if (pollingStatus !== "queued" && pollingStatus !== "indexing" && pollingStatus !== "uploading") return;
    const timer = window.setInterval(async () => {
      const status = await getDocumentStatusRequest(requireAccessToken(), documentId).catch(() => null);
      if (!status) return;
      if (status.state === "live") reload();
      else setState({ kind: "notLive", status });
    }, STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [pollingStatus, documentId, reload]);

  return { state, reload };
};
