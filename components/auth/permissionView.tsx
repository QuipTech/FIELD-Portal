"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/lib/auth/usePermissions";
import type { PermissionCode } from "@/lib/auth/permissionCodes";
import { PermissionNotice } from "./permissionNotice";

interface PermissionViewProps {
  permission: PermissionCode;
  children: ReactNode;
  className?: string;
  fallbackAction?: ReactNode;
}

// Renders `children` only with `permission`; otherwise a notice in their
// place. Nothing renders until permissions are known, so restricted
// content never flashes on screen.
export const PermissionView = ({ permission, children, className, fallbackAction }: PermissionViewProps) => {
  const { isLoaded, can } = usePermissions();
  if (!isLoaded) return null;
  return can(permission) ? <>{children}</> : (
    <PermissionNotice permission={permission} className={className} action={fallbackAction} />
  );
};
