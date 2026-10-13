"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { useHorizontalOverflow } from "@/lib/hooks/useHorizontalOverflow";
import { useCachedResource } from "@/lib/machineDetail/useCachedResource";
import { machineCacheKeys } from "@/lib/machineDetail/machineDetailCacheKeys";
import { useMachineDetail } from "../machineDetailContext";

export const SECTION_LABEL_CLASSES = "text-xs font-semibold uppercase tracking-wider text-mutedGray";

const arrowClasses =
  "absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-borderGray bg-surface shadow-sm hover:bg-fillGray";

// The machine's systems as one row of tabs. Any number fits: the row
// scrolls sideways (arrows appear when it overflows) and keeps the
// selected system in view. The choice is ?system=<id>, so it survives a
// reload; without one, the first system is selected.
export const SystemsTabs = () => {
  const { machineId, service } = useMachineDetail();
  const systems = useCachedResource(machineCacheKeys.systems(machineId), () => service.listSystems(machineId), "Couldn't load systems.");
  const selectedId = useSearchParams().get("system") ?? systems.data?.[0]?.id;
  const { ref, canScrollLeft, canScrollRight, scrollByStep, measure } = useHorizontalOverflow<HTMLDivElement>();

  useEffect(() => {
    measure();
    ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedId, systems.data, measure, ref]);

  if (systems.isLoading) return <SkeletonBar className="h-9 w-full max-w-xl rounded-lg" />;
  if (systems.error) {
    return (
      <button type="button" onClick={systems.reload} className="self-start text-sm text-danger hover:underline">
        Couldn&apos;t load systems · retry
      </button>
    );
  }
  if (!systems.data?.length) return null;

  return (
    <section className="flex flex-none flex-col gap-1.5">
      <h2 className={SECTION_LABEL_CLASSES}>Systems</h2>
      <nav aria-label="Systems" className="relative">
        {canScrollLeft && (
          <button type="button" aria-label="Previous systems" onClick={() => scrollByStep(-1)} className={`${arrowClasses} left-0`}>
            <Icon name="chevl" />
          </button>
        )}
        <div ref={ref} className="flex gap-2 overflow-x-auto scroll-smooth px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {systems.data.map((system) => {
            const isSelected = system.id === selectedId;
            return (
              <Link
                key={system.id}
                href={`/machines/${machineId}?system=${encodeURIComponent(system.id)}`}
                replace
                scroll={false}
                aria-current={isSelected ? "page" : undefined}
                className={`flex flex-none items-center gap-2 whitespace-nowrap rounded-lg border px-3.5 py-2 text-sm transition-colors ${
                  isSelected
                    ? "border-primaryBorder bg-primaryTint font-medium text-primary"
                    : "border-borderGray bg-surface text-bodyGray hover:text-ink"
                }`}
              >
                <Icon name="layers" className={`h-4 w-4 ${isSelected ? "stroke-primary" : "stroke-mutedGray"}`} />
                {system.name}
              </Link>
            );
          })}
        </div>
        {canScrollRight && (
          <button type="button" aria-label="More systems" onClick={() => scrollByStep(1)} className={`${arrowClasses} right-0`}>
            <Icon name="chevr" />
          </button>
        )}
      </nav>
    </section>
  );
};
