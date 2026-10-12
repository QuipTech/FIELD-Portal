"use client";

import { useCallback, useEffect, useState } from "react";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { useCachedResource } from "@/lib/machineDetail/useCachedResource";
import { machineCacheKeys } from "@/lib/machineDetail/machineDetailCacheKeys";
import type { MachineDetailService } from "@/lib/types/machineDetailService";
import type { HistoryEntry, HistoryFilters, HistoryPage } from "@/lib/types/historyEntry";
import { HISTORY_PAGE_SIZE } from "./historyPaging";

const LOAD_FAILED_MESSAGE = "Couldn't load this machine's history.";

// The timeline's saved entries for the current filters. The first page is
// cached (and prefetched by the shell); "Load more" appends the next.
export const useHistoryPages = (service: MachineDetailService, machineId: string, filters: HistoryFilters) => {
  const firstPage = useCachedResource<HistoryPage>(
    machineCacheKeys.historyFirstPage(machineId, filters),
    () => service.listHistory(machineId, { ...filters, offset: 0, limit: HISTORY_PAGE_SIZE }),
    LOAD_FAILED_MESSAGE,
  );
  const authors = useCachedResource(
    machineCacheKeys.historyAuthors(machineId),
    () => service.listHistoryAuthors(machineId),
    "Couldn't load authors.",
  );
  const [extraEntries, setExtraEntries] = useState<HistoryEntry[]>([]);
  const [hasMorePages, setHasMorePages] = useState<boolean | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  useEffect(() => {
    setExtraEntries([]);
    setHasMorePages(null);
    setLoadMoreError(null);
  }, [machineId, filters]);

  const entries = [...(firstPage.data?.items ?? []), ...extraEntries];

  const loadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await service.listHistory(machineId, { ...filters, offset: entries.length, limit: HISTORY_PAGE_SIZE });
      setExtraEntries((current) => [...current, ...page.items]);
      setHasMorePages(page.hasMore);
    } catch (error) {
      setLoadMoreError(toApiErrorMessage(error, LOAD_FAILED_MESSAGE));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const { setData: setFirstPage } = firstPage;
  const firstPageData = firstPage.data;
  const prependEntry = useCallback(
    (entry: HistoryEntry) =>
      setFirstPage({ items: [entry, ...(firstPageData?.items ?? [])], hasMore: firstPageData?.hasMore ?? false }),
    [setFirstPage, firstPageData],
  );

  const removePhoto = (entryId: string, photoId: string) => {
    const withoutPhoto = (entry: HistoryEntry) =>
      entry.id === entryId ? { ...entry, photos: entry.photos.filter((photo) => photo.id !== photoId) } : entry;
    if (firstPageData) setFirstPage({ ...firstPageData, items: firstPageData.items.map(withoutPhoto) });
    setExtraEntries((current) => current.map(withoutPhoto));
  };

  return {
    entries,
    authors: authors.data ?? [],
    hasMore: hasMorePages ?? firstPage.data?.hasMore ?? false,
    isLoading: firstPage.isLoading,
    isLoadingMore,
    error: firstPage.error ?? loadMoreError,
    loadMore,
    reload: firstPage.reload,
    prependEntry,
    removePhoto,
  };
};
