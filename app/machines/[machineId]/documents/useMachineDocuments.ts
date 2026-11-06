"use client";

import { useCallback, useEffect } from "react";
import { machineCacheKeys, machineKeyPrefix } from "@/lib/machineDetail/machineDetailCacheKeys";
import { invalidateCached } from "@/lib/machineDetail/resourceCache";
import { useCachedResource } from "@/lib/machineDetail/useCachedResource";
import type { MachineDetailService } from "@/lib/types/machineDetailService";

// Before the 15-minute signed links expire on a page left open.
const REFRESH_LINKS_EVERY_MS = 10 * 60 * 1000;

export const useMachineDocuments = (service: MachineDetailService, machineId: string) => {
  const documents = useCachedResource(
    machineCacheKeys.documents(machineId),
    () => service.listDocuments(machineId),
    "Couldn't load this machine's documents.",
  );
  const { reload } = documents;

  useEffect(() => {
    const timer = setInterval(reload, REFRESH_LINKS_EVERY_MS);
    return () => clearInterval(timer);
  }, [reload]);

  // A deleted file may also be on a history entry, so everything cached for
  // the machine is dropped.
  const reloadAfterChange = useCallback(() => {
    invalidateCached(machineKeyPrefix(machineId));
    reload();
  }, [machineId, reload]);

  return { ...documents, reloadAfterChange };
};
