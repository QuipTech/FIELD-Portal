import { Icon } from "@/components/icons/icon";
import { Button } from "./button";

interface LoadErrorStateProps {
  message: string;
  onRetry: () => void;
  className?: string;
}

// What a panel shows when its data failed to load.
export const LoadErrorState = ({ message, onRetry, className = "" }: LoadErrorStateProps) => (
  <div role="alert" className={`flex flex-col items-center justify-center gap-3 p-8 text-center ${className}`}>
    <span className="flex items-center gap-2 text-sm text-danger">
      <Icon name="alert" className="h-4 w-4 stroke-danger" />
      {message}
    </span>
    <Button size="sm" onClick={onRetry}>
      Try again
    </Button>
  </div>
);
