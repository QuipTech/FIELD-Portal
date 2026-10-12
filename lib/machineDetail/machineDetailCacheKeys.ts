import type { HistoryFilters } from "@/lib/types/historyEntry";

// Cache keys for one machine's data; invalidateCached(machineKeyPrefix(id))
// drops all of it.
export const machineKeyPrefix = (machineId: string) => `machine:${machineId}:`;

export const machineCacheKeys = {
  machine: (machineId: string) => `${machineKeyPrefix(machineId)}detail`,
  photos: (machineId: string) => `${machineKeyPrefix(machineId)}photos`,
  systems: (machineId: string) => `${machineKeyPrefix(machineId)}systems`,
  components: (machineId: string) => `${machineKeyPrefix(machineId)}components`,
  snapshots: (machineId: string) => `${machineKeyPrefix(machineId)}snapshots`,
  diff: (machineId: string, fromId: string, toId: string) => `${machineKeyPrefix(machineId)}diff:${fromId}:${toId}`,
  historyAuthors: (machineId: string) => `${machineKeyPrefix(machineId)}historyAuthors`,
  historyFirstPage: (machineId: string, filters: HistoryFilters) =>
    `${machineKeyPrefix(machineId)}history:${filters.type}:${filters.range}:${filters.authorId}`,
};
