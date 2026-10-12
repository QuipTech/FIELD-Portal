import { SkeletonBar } from "@/components/ui/skeletonBar";

// The thread's shape while it loads: alternating bubbles and a system line.
export const CaseThreadSkeleton = () => (
  <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading messages">
    <div className="flex gap-2.5">
      <SkeletonBar className="h-[30px] w-[30px] rounded-full" />
      <SkeletonBar className="h-16 w-2/3 rounded-xl" />
    </div>
    <SkeletonBar className="mx-auto h-3 w-1/3" />
    <div className="flex flex-row-reverse gap-2.5">
      <SkeletonBar className="h-[30px] w-[30px] rounded-full" />
      <SkeletonBar className="h-12 w-1/2 rounded-xl" />
    </div>
    <div className="flex gap-2.5">
      <SkeletonBar className="h-[30px] w-[30px] rounded-full" />
      <SkeletonBar className="h-10 w-2/5 rounded-xl" />
    </div>
  </div>
);
