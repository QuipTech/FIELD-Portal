"use client";

import { useCallback, useEffect, useState } from "react";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import {
  deleteKnowledgeDocumentRequest,
  getKnowledgeDownloadUrlRequest,
  listKnowledgeDocumentsRequest,
} from "@/lib/api/adminKnowledgeApi";
import {
  approveDocumentRequest,
  archiveDocumentRequest,
  getDocumentStatusRequest,
  rejectDocumentRequest,
  retryDocumentRequest,
} from "@/lib/api/documentLifecycleApi";
import { IN_PROGRESS_DOCUMENT_STATES, type KnowledgeDocument } from "@/lib/types/adminDocument";

// The table has no pager yet, so fetch the backend's maximum page.
const PAGE_SIZE = 100;
const STATUS_POLL_MS = 3000;
// Page counts are filled in by a background job after upload.
const PAGE_COUNT_POLL_MS = 4000;
const LOAD_FAILED_MESSAGE = "Couldn't load documents. Please try again.";

const isInProgress = (document: KnowledgeDocument) => IN_PROGRESS_DOCUMENT_STATES.includes(document.state);

export type DocumentAction = "approve" | "retry" | "archive";

const actionRequests = {
  approve: approveDocumentRequest,
  retry: retryDocumentRequest,
  archive: archiveDocumentRequest,
};

export const useKnowledgeDocuments = () => {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reloadDocuments = useCallback(async () => {
    try {
      const list = await listKnowledgeDocumentsRequest(requireAccessToken(), { pageSize: PAGE_SIZE });
      setDocuments(list.documents);
      setTotal(list.total);
      setLoadError(null);
    } catch (error) {
      setLoadError(toApiErrorMessage(error, LOAD_FAILED_MESSAGE));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadDocuments();
  }, [reloadDocuments]);

  const replaceDocument = (updated: KnowledgeDocument) =>
    setDocuments((current) => current.map((document) => (document.id === updated.id ? updated : document)));

  // Queued/indexing rows: GET /documents/:id/status every 3 s. Once any of
  // them reaches a final state, reload the list (page count, dates…).
  const inProgressIds = documents.filter(isInProgress).map((document) => document.id).join(",");
  useEffect(() => {
    if (!inProgressIds) return;
    const timer = setInterval(async () => {
      const statuses = await Promise.all(
        inProgressIds.split(",").map((id) =>
          getDocumentStatusRequest(requireAccessToken(), id).then(
            (status) => ({ id, status }),
            () => null,
          ),
        ),
      );
      const changed = statuses.filter((entry) => entry !== null);
      setDocuments((current) =>
        current.map((document) => {
          const entry = changed.find((candidate) => candidate.id === document.id);
          return entry ? { ...document, ...entry.status } : document;
        }),
      );
      if (changed.some((entry) => !IN_PROGRESS_DOCUMENT_STATES.includes(entry.status.state))) reloadDocuments();
    }, STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [inProgressIds, reloadDocuments]);

  // Keeps refreshing only while some document is still waiting for its
  // page count, then stops.
  const isAwaitingPageCounts = documents.some((document) => document.isPageCountPending && !isInProgress(document));
  useEffect(() => {
    if (!isAwaitingPageCounts) return;
    const timer = setInterval(reloadDocuments, PAGE_COUNT_POLL_MS);
    return () => clearInterval(timer);
  }, [isAwaitingPageCounts, reloadDocuments]);

  // Opens the file through a short-lived signed S3 link.
  const downloadDocument = async (documentId: string) => {
    const { url } = await getKnowledgeDownloadUrlRequest(requireAccessToken(), documentId);
    window.location.assign(url);
  };

  // Each rejects with the API error so the caller can show it.
  const runAction = async (documentId: string, action: DocumentAction) =>
    replaceDocument(await actionRequests[action](requireAccessToken(), documentId));

  const rejectDocument = async (documentId: string, reason: string) =>
    replaceDocument(await rejectDocumentRequest(requireAccessToken(), documentId, reason));

  const deleteDocument = async (documentId: string) => {
    await deleteKnowledgeDocumentRequest(requireAccessToken(), documentId);
    await reloadDocuments();
  };

  return {
    documents,
    total,
    isLoading,
    loadError,
    reloadDocuments,
    downloadDocument,
    runAction,
    rejectDocument,
    deleteDocument,
  };
};
