import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons/icon";

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
  // Buttons or links for what to do next.
  actions?: ReactNode;
  className?: string;
}

// What a panel shows when there's nothing in it yet.
export const EmptyState = ({ icon, title, description, actions, className = "" }: EmptyStateProps) => (
  <div className={`flex flex-col items-center justify-center gap-2 px-6 py-10 text-center ${className}`}>
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-fillGray text-mutedGray">
      <Icon name={icon} className="h-5 w-5" />
    </span>
    <span className="text-[15px] font-medium text-ink">{title}</span>
    {description && <p className="max-w-md text-sm text-mutedGray">{description}</p>}
    {actions && <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>}
  </div>
);
