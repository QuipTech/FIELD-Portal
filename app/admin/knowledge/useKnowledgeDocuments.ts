"use client";

import { useCallback, useEffect, useState } from "react";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import {
  deleteKnowledgeDocumentRequest,
  getKnowledgeDownloadUrlRequest,
  listKnowledgeDocumentsRequest,
} from "@/lib/api/adminKnowledgeApi";
import type { KnowledgeDocument } from "@/lib/types/adminDocument";

// The table has no pager yet, so fetch the backend's maximum page.
const PAGE_SIZE = 100;
// Page counts are filled in by a background job after upload.
const PAGE_COUNT_POLL_MS = 4000;
const LOAD_FAILED_MESSAGE = "Couldn't load documents. Please try again.";


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

  // Keeps refreshing only while some document is still waiting for its
  // page count, then stops.
  const isAwaitingPageCounts = documents.some((document) => document.isPageCountPending);
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

  const deleteDocument = async (documentId: string) => {
    await deleteKnowledgeDocumentRequest(requireAccessToken(), documentId);
    await reloadDocuments();
  };

  return { documents, total, isLoading, loadError, reloadDocuments, downloadDocument, deleteDocument };
};
