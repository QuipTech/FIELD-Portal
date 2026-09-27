type LoadingSpinnerSize = "sm" | "md";

interface LoadingSpinnerProps {
  size?: LoadingSpinnerSize;
  className?: string;
}

const sizeClasses: Record<LoadingSpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-[3px]",
};

// Takes the current text colour, so it matches whatever it sits in.
export const LoadingSpinner = ({ size = "sm", className = "" }: LoadingSpinnerProps) => {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block flex-none animate-spin rounded-full border-current border-t-transparent ${sizeClasses[size]} ${className}`}
    />
  );
};
