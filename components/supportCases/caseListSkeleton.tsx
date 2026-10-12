import { SkeletonBar } from "@/components/ui/skeletonBar";

const ROWS = 6;

// A cases table's shape while it loads.
export const CaseListSkeleton = () => (
  <div
    className="flex flex-col overflow-hidden rounded-xl border border-borderGray bg-surface"
    aria-busy="true"
    aria-label="Loading cases"
  >
    <div className="border-b border-borderGray bg-fillGray px-4 py-3">
      <SkeletonBar className="h-3 w-1/3" />
    </div>
    {Array.from({ length: ROWS }, (_, index) => (
      <div key={index} className="flex items-center gap-4 border-b border-borderGray px-4 py-4 last:border-b-0">
        <SkeletonBar className="h-3 w-10" />
        <SkeletonBar className="h-3 flex-1" />
        <SkeletonBar className="h-5 w-20" />
        <SkeletonBar className="h-5 w-10" />
        <SkeletonBar className="h-3 w-24" />
      </div>
    ))}
  </div>
);
