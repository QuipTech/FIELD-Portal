import { prefetchCached } from "@/lib/machineDetail/resourceCache";
import { machineCacheKeys } from "@/lib/machineDetail/machineDetailCacheKeys";
import type { MachineDetailService } from "@/lib/types/machineDetailService";
import { DEFAULT_HISTORY_FILTERS, HISTORY_PAGE_SIZE } from "./history/historyPaging";

// Loads every tab's first view in parallel, so switching tabs is instant.
// Requests a visible tab already made are shared, not repeated.
export const prefetchMachineDetail = (service: MachineDetailService, machineId: string): void => {
  prefetchCached(machineCacheKeys.photos(machineId), () => service.listPhotos(machineId));
  prefetchCached(machineCacheKeys.systems(machineId), () => service.listSystems(machineId));
  prefetchCached(machineCacheKeys.components(machineId), () => service.listComponents(machineId, null));
  prefetchCached(machineCacheKeys.snapshots(machineId), () => service.listSnapshots(machineId));
  prefetchCached(machineCacheKeys.historyAuthors(machineId), () => service.listHistoryAuthors(machineId));
  prefetchCached(machineCacheKeys.historyFirstPage(machineId, DEFAULT_HISTORY_FILTERS), () =>
    service.listHistory(machineId, { ...DEFAULT_HISTORY_FILTERS, offset: 0, limit: HISTORY_PAGE_SIZE }),
  );
};
