import { SkeletonBar as Bar } from "@/components/ui/skeletonBar";

// Placeholder rows shaped like the loaded page.
export const DataRetentionSkeleton = () => {
  return (
    <div aria-busy="true" aria-label="Loading data & retention settings" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 p-4">
        {[0, 1, 2, 3].map((row) => (
          <Bar key={row} className="h-6 w-full" />
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 p-4">
        {[0, 1, 2].map((row) => (
          <Bar key={row} className="h-8 w-3/4" />
        ))}
      </div>
      <Bar className="h-16 w-full" />
    </div>
  );
};
