import { SkeletonBar } from "@/components/ui/skeletonBar";

// Title, tags and three blocks while the article loads.
export const ArticleSkeleton = () => (
  <div className="flex flex-col gap-4 p-6" aria-busy="true" aria-label="Loading document">
    <SkeletonBar className="h-7 w-2/3" />
    <div className="flex gap-2">
      <SkeletonBar className="h-6 w-20" />
      <SkeletonBar className="h-6 w-24" />
      <SkeletonBar className="h-6 w-14" />
    </div>
    {[0, 1, 2].map((block) => (
      <div key={block} className="flex flex-col gap-2 pt-3">
        <SkeletonBar className="h-5 w-1/3" />
        <SkeletonBar className="h-4 w-full" />
        <SkeletonBar className="h-4 w-11/12" />
        <SkeletonBar className="h-4 w-4/5" />
      </div>
    ))}
  </div>
);
