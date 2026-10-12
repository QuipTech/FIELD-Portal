"use client";

import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/emptyState";
import { useSupportStaffAccess } from "@/lib/hooks/useSupportStaffAccess";

// Renders `children` only for QuipTech support staff; nothing until known,
// so staff-only content never flashes. The API enforces this regardless.
export const SupportStaffView = ({ children, className = "" }: { children: ReactNode; className?: string }) => {
  const { isLoaded, isStaff } = useSupportStaffAccess();
  if (!isLoaded) return null;
  return isStaff ? (
    <>{children}</>
  ) : (
    <EmptyState
      icon="lock"
      title="Support staff only"
      description="Only QuipTech's support team can work customer cases here."
      className={className}
    />
  );
};
