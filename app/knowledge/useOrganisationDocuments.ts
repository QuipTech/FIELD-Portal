"use client";

import { useCallback, useEffect, useState } from "react";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { listDocumentsRequest, type OrganisationDocument } from "@/lib/api/documentsApi";

const LOAD_FAILED_MESSAGE = "Couldn't load documents. Please try again.";

// Download links in the list are signed when it loads and expire after 15
// minutes; reloading (e.g. after an upload) signs fresh ones.
export const useOrganisationDocuments = () => {
  const [documents, setDocuments] = useState<OrganisationDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reloadDocuments = useCallback(async () => {
    try {
      const list = await listDocumentsRequest(requireAccessToken());
      setDocuments(list.documents);
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

  return { documents, isLoading, loadError, reloadDocuments };
};
