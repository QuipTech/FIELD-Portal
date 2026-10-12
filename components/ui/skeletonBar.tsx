// A pulsing placeholder block; size and shape come from className.
export const SkeletonBar = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-md bg-slate-100 ${className}`} />
);
