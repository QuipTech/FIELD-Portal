"use client";

import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import {
  listDemoRequestsRequest,
  resendDemoRequestEmailsRequest,
  updateDemoRequestRequest,
} from "@/lib/api/demoRequestsApi";
import type { DemoRequest, DemoRequestStatus, DemoRequestUpdate } from "@/lib/types/demoRequest";

export const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

export const useDemoRequests = () => {
  // "" = every status.
  const [status, setStatus] = useState<DemoRequestStatus | "">("");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // A new filter starts from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const changeStatus = (next: DemoRequestStatus | "") => {
    setStatus(next);
    setPage(1);
  };

  const list = useApiResource(
    (accessToken) =>
      listDemoRequestsRequest(accessToken, { status: status || undefined, search, page, pageSize: PAGE_SIZE }),
    [status, search, page],
    "Couldn't load demo requests. Please try again.",
  );

  // Puts the saved request into the loaded page, so the table matches
  // the drawer without a reload.
  const replaceInList = (updated: DemoRequest) =>
    list.setData((current) =>
      current
        ? { ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) }
        : current,
    );

  // Both reject with the API's error so the drawer can show it.
  const saveRequest = async (requestId: string, update: DemoRequestUpdate) => {
    const updated = await updateDemoRequestRequest(requireAccessToken(), requestId, update);
    replaceInList(updated);
    return updated;
  };

  const resendEmails = async (requestId: string) => {
    const result = await resendDemoRequestEmailsRequest(requireAccessToken(), requestId);
    replaceInList(result.request);
    return result;
  };

  return {
    status,
    setStatus: changeStatus,
    searchText,
    setSearchText,
    page,
    setPage,
    list: list.data,
    isLoading: list.isLoading,
    loadError: list.error,
    saveRequest,
    resendEmails,
  };
};
