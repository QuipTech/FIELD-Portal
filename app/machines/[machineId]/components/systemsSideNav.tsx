"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { useCachedResource } from "@/lib/machineDetail/useCachedResource";
import { machineCacheKeys } from "@/lib/machineDetail/machineDetailCacheKeys";
import { useMachineDetail } from "../machineDetailContext";
import { SystemsEmptyNotice } from "./systemsEmptyNotice";

const itemClasses = "flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[15px] transition-colors";

// The selected system is ?system=<id> on the components tab, so the
// choice survives a reload; without one, the first system is selected.
export const SystemsSideNav = () => {
  const { machineId, service } = useMachineDetail();
  const systems = useCachedResource(machineCacheKeys.systems(machineId), () => service.listSystems(machineId), "Couldn't load systems.");
  const selectedId = useSearchParams().get("system") ?? systems.data?.[0]?.id;

  return (
    <nav aria-label="Systems" className="flex w-[200px] flex-none flex-col gap-0.5 overflow-y-auto rounded-r-[18px] bg-gradient-to-b from-brandDeep to-[#221C52] p-3">
      <span className="px-2.5 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-white/50">Systems</span>
      {systems.isLoading &&
        [0, 1, 2, 3, 4, 5].map((row) => <div key={row} className="mx-2.5 my-2 h-5 animate-pulse rounded bg-white/10" />)}
      {systems.error && (
        <button type="button" onClick={systems.reload} className={`${itemClasses} text-left text-white/75 hover:bg-white/10`}>
          <Icon name="alert" className="stroke-white/60" /> Couldn&apos;t load · retry
        </button>
      )}
      {systems.data?.length === 0 && <SystemsEmptyNotice onCheckAgain={systems.reload} />}
      {systems.data?.map((system) => {
        const isSelected = system.id === selectedId;
        return (
          <Link
            key={system.id}
            href={`/machines/${machineId}?system=${encodeURIComponent(system.id)}`}
            replace
            scroll={false}
            aria-current={isSelected ? "page" : undefined}
            className={`${itemClasses} ${isSelected ? "bg-white/[0.16] font-medium text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
          >
            <Icon name="layers" className={isSelected ? "stroke-white" : "stroke-white/60"} />
            {system.name}
          </Link>
        );
      })}
    </nav>
  );
};
