"use client";

import type { SearchSelectOption } from "@/components/ui/searchSelect";
import type { MachineDetailService } from "@/lib/types/machineDetailService";
import { useCachedResource } from "./useCachedResource";
import { machineCacheKeys } from "./machineDetailCacheKeys";

// The machine's components as "System › Component" choices for the
// entry form; loaded only while the form is open (usually from cache).
export const useComponentOptions = (
  service: MachineDetailService,
  machineId: string | null,
  isNeeded: boolean,
): SearchSelectOption[] => {
  const components = useCachedResource(
    machineId && isNeeded ? machineCacheKeys.components(machineId) : null,
    () => service.listComponents(machineId as string, null),
    "Couldn't load components.",
  );
  return (components.data ?? []).map((component) => ({ value: component.id, group: component.systemName, label: component.name }));
};
