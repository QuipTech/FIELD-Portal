"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icons/icon";
import { PermissionButton } from "@/components/auth/permissionButton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/emptyState";
import { HistoryEntryModal } from "@/components/machines/historyEntryModal";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { ApiError } from "@/lib/api/httpClient";
import type { HistoryEntry, HistoryFilters, NewHistoryEntry } from "@/lib/types/historyEntry";
import { invalidateCached } from "@/lib/machineDetail/resourceCache";
import { machineKeyPrefix } from "@/lib/machineDetail/machineDetailCacheKeys";
import { useMachineDetail } from "../machineDetailContext";
import { useHistoryPages } from "./useHistoryPages";
import { DEFAULT_HISTORY_FILTERS } from "./historyPaging";
import { usePendingHistoryEntries } from "./usePendingHistoryEntries";
import { useComponentOptions } from "@/lib/machineDetail/useComponentOptions";
import { HistoryFilterBar } from "./components/historyFilterBar";
import { HistoryTimeline } from "./components/historyTimeline";

const SAVE_FAILED_MESSAGE = "Couldn't save the entry. Please try again.";

// API errors carry the server's reason; a plain Error is one of ours.
const toSaveErrorMessage = (error: unknown) =>
  error instanceof Error && !(error instanceof ApiError) ? error.message : toApiErrorMessage(error, SAVE_FAILED_MESSAGE);

// History tab: the machine's timeline, newest first, and "Add entry".
const MachineHistoryPage = () => {
  const { machineId, machine, service, notify, notifyError } = useMachineDetail();
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_HISTORY_FILTERS);
  const [isAdding, setIsAdding] = useState(false);
  const pages = useHistoryPages(service, machineId, filters);
  const { prependEntry } = pages;
  // A saved entry can change components' condition, snapshots, authors and
  // the hour meter, so everything cached for the machine is refetched.
  const showSavedEntry = useCallback(
    (entry: HistoryEntry) => {
      invalidateCached(machineKeyPrefix(machineId));
      prependEntry(entry);
    },
    [machineId, prependEntry],
  );
  const { pending, createEntry } = usePendingHistoryEntries(service, machineId, showSavedEntry);
  const componentOptions = useComponentOptions(service, machineId, isAdding);
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_HISTORY_FILTERS);

  // ?add=entry (e.g. from the Components tab) opens the form straight away.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("add") === "entry") setIsAdding(true);
  }, []);

  const emptyState = isFiltered ? (
    <EmptyState
      icon="filter"
      title="No entries match these filters"
      description="Try a longer date range or another type or author."
      actions={<Button onClick={() => setFilters(DEFAULT_HISTORY_FILTERS)}>Clear filters</Button>}
    />
  ) : (
    <EmptyState
      icon="history"
      title="No history yet"
      description="Log repairs, inspections, faults and services here so the whole team (and the AI assistant) can see what's been done."
      actions={
        <PermissionButton permission={PERMISSIONS.addHistoryEntry} variant="primary" onClick={() => setIsAdding(true)}>
          <Icon name="plus" />
          Add the first entry
        </PermissionButton>
      }
    />
  );

  const saveEntry = async (entry: NewHistoryEntry) => {
    const outcome = await createEntry(entry);
    setIsAdding(false);
    if (outcome.kind === "offline") notify("Saved offline — syncs when back in range");
    else if (outcome.missingPhotos > 0) notifyError(`Entry saved, but ${outcome.missingPhotos} photo(s) didn't upload.`);
    else notify("History entry saved");
  };

  // Rejects on failure, which the confirm dialog shows.
  const deletePhoto = async (entryId: string, photoId: string) => {
    await service.deleteHistoryPhoto(machineId, entryId, photoId);
    pages.removePhoto(entryId, photoId);
    notify("Photo deleted");
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <HistoryFilterBar filters={filters} authors={pages.authors} onChange={setFilters} />
        <PermissionButton permission={PERMISSIONS.addHistoryEntry} variant="primary" className="ml-auto" onClick={() => setIsAdding(true)}>
          <Icon name="plus" />
          Add entry
        </PermissionButton>
      </div>
      <HistoryTimeline
        entries={[...pending, ...pages.entries]}
        isLoading={pages.isLoading}
        error={pages.error}
        onRetry={pages.reload}
        hasMore={pages.hasMore}
        isLoadingMore={pages.isLoadingMore}
        onLoadMore={() => void pages.loadMore()}
        onDeletePhoto={deletePhoto}
        emptyState={emptyState}
      />
      {isAdding && (
        <HistoryEntryModal
          machineLabel={machine?.assetId ?? ""}
          componentOptions={componentOptions}
          defaultHours={machine?.operatingHours ?? null}
          onSubmit={saveEntry}
          toErrorMessage={toSaveErrorMessage}
          onClose={() => setIsAdding(false)}
        />
      )}
    </section>
  );
};

export default MachineHistoryPage;
