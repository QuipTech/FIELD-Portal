"use client";

import { useEffect, useRef } from "react";
import type { MachineDetailService } from "@/lib/types/machineDetailService";
import { listQueuedHistoryEntries, removeQueuedHistoryEntry } from "@/lib/machineDetail/offlineHistoryQueue";
import { announceHistorySynced } from "@/lib/machineDetail/historySyncEvent";

// Sends this machine's offline-queued history entries, oldest first,
// when the page opens and whenever the connection comes back. An entry
// the server rejects stays queued for the next attempt.
export const useOfflineHistorySync = (
  machineId: string,
  service: MachineDetailService,
  notify: (message: string) => void,
): void => {
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const syncQueuedEntries = async () => {
      if (isSyncingRef.current || !navigator.onLine) return;
      isSyncingRef.current = true;
      let syncedCount = 0;
      try {
        for (const queued of await listQueuedHistoryEntries(machineId)) {
          const entry = await service.createHistoryEntry(machineId, queued.entry);
          await removeQueuedHistoryEntry(queued.id);
          announceHistorySynced({ queuedId: queued.id, entry });
          syncedCount += 1;
        }
      } catch {
        // The failed entry and those after it stay queued for the next sync.
      } finally {
        isSyncingRef.current = false;
        if (syncedCount > 0) notify(syncedCount === 1 ? "Offline entry synced" : `${syncedCount} offline entries synced`);
      }
    };
    const runSync = () => void syncQueuedEntries();

    runSync();
    window.addEventListener("online", runSync);
    return () => window.removeEventListener("online", runSync);
  }, [machineId, service, notify]);
};
