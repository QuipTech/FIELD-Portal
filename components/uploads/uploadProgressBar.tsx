interface UploadProgressBarProps {
  // 0–1.
  fraction: number;
  className?: string;
}

export const UploadProgressBar = ({ fraction, className = "" }: UploadProgressBarProps) => {
  const percent = Math.round(fraction * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-1 overflow-hidden rounded-full bg-fillGray ${className}`}
    >
      <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
};
