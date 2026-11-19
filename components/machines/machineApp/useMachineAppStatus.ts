"use client";

import { useCallback, useEffect, useState } from "react";
import { getMachineAppConnectionRequest } from "@/lib/api/machineAppConnectionApi";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { MachineAppConnection } from "@/lib/types/machineAppConnection";
import { machineCacheKeys } from "@/lib/machineDetail/machineDetailCacheKeys";
import { writeCached } from "@/lib/machineDetail/resourceCache";

// Presence must bypass the detail cache. Poll serially so a slow request
// cannot overwrite a newer observation or pile up overlapping requests.
export const useMachineAppStatus = (machineId: string, enabled = true) => {
  const [state, setState] = useState<{
    machineId: string;
    data: MachineAppConnection | null;
    error: string | null;
  }>({ machineId, data: null, error: null });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await getMachineAppConnectionRequest(machineId);
        if (!current) return;
        writeCached(machineCacheKeys.appConnection(machineId), data);
        setState({ machineId, data, error: null });
      } catch (error) {
        if (!current) return;
        // Keep pairing details but stop claiming stale Online/Offline status.
        setState((previous) => ({ machineId, data: previous.machineId === machineId ? previous.data : null,
          error: toApiErrorMessage(error, "Couldn't refresh tablet status.") }));
      } finally {
        if (current) timer = setTimeout(poll, 5000);
      }
    };
    void poll();
    return () => { current = false; clearTimeout(timer); };
  }, [machineId, revision, enabled]);
  const current = state.machineId === machineId;
  return { data: current ? state.data : null,
    error: current ? state.error : null, isLoading: !current || (!state.data && !state.error), reload };
};
