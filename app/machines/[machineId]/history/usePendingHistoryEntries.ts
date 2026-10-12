"use client";

import { useEffect, useState } from "react";
import type { MachineDetailService } from "@/lib/types/machineDetailService";
import type { HistoryEntry, NewHistoryEntry } from "@/lib/types/historyEntry";
import { listQueuedHistoryEntries, queueHistoryEntry } from "@/lib/machineDetail/offlineHistoryQueue";
import { HISTORY_SYNCED_EVENT, type HistorySyncedDetail } from "@/lib/machineDetail/historySyncEvent";
import { toPendingHistoryEntry } from "@/lib/machineDetail/toPendingHistoryEntry";
import { isOfflineError } from "@/lib/machineDetail/isOfflineError";

export type SaveOutcome = { kind: "saved"; missingPhotos: number } | { kind: "offline" };

// Entries not on the server yet, shown above the timeline: optimistic ones
// while their POST runs, and ones saved offline until they sync.
export const usePendingHistoryEntries = (
  service: MachineDetailService,
  machineId: string,
  onSaved: (entry: HistoryEntry) => void,
) => {
  const [pending, setPending] = useState<HistoryEntry[]>([]);
  const removePending = (id: string) => setPending((current) => current.filter((entry) => entry.id !== id));

  useEffect(() => {
    listQueuedHistoryEntries(machineId)
      .then((queued) => setPending(queued.reverse().map((item) => toPendingHistoryEntry(item.id, item.entry, "offline", item.queuedAt))))
      .catch(() => undefined);
  }, [machineId]);

  useEffect(() => {
    const handleSynced = (event: Event) => {
      const { queuedId, entry } = (event as CustomEvent<HistorySyncedDetail>).detail;
      setPending((current) => current.filter((item) => item.id !== queuedId));
      onSaved(entry);
    };
    window.addEventListener(HISTORY_SYNCED_EVENT, handleSynced);
    return () => window.removeEventListener(HISTORY_SYNCED_EVENT, handleSynced);
  }, [onSaved]);

  const saveOffline = async (id: string, entry: NewHistoryEntry): Promise<SaveOutcome> => {
    try {
      await queueHistoryEntry({ id, machineId, queuedAt: new Date().toISOString(), entry });
    } catch {
      removePending(id);
      throw new Error("You're offline and this browser can't store the entry. Try again when back in range.");
    }
    setPending((current) => current.map((item) => (item.id === id ? { ...item, syncState: "offline" } : item)));
    return { kind: "offline" };
  };

  // Rejects (after rolling the optimistic entry back) when the server
  // refuses the entry; a lost connection queues it instead.
  const createEntry = async (entry: NewHistoryEntry): Promise<SaveOutcome> => {
    const id = `pending-${crypto.randomUUID()}`;
    setPending((current) => [toPendingHistoryEntry(id, entry, "saving"), ...current]);
    if (!navigator.onLine) return saveOffline(id, entry);
    try {
      const saved = await service.createHistoryEntry(machineId, entry);
      removePending(id);
      onSaved(saved);
      return { kind: "saved", missingPhotos: entry.photos.length - saved.photos.length };
    } catch (error) {
      if (isOfflineError(error)) return saveOffline(id, entry);
      removePending(id);
      throw error;
    }
  };

  return { pending, createEntry };
};
