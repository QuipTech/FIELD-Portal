import type { ReactNode } from "react";
import { IconTile } from "@/components/ui/iconTile";
import { describeMissingPermission, type PermissionCode } from "@/lib/auth/permissionCodes";

interface PermissionNoticeProps {
  permission: PermissionCode;
  className?: string;
  // E.g. a way back, where the notice replaces a whole screen.
  action?: ReactNode;
}

// Stands in for a feature the user's role doesn't allow.
export const PermissionNotice = ({ permission, className = "", action }: PermissionNoticeProps) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-2.5 p-10 text-center ${className}`}>
      <IconTile icon="lock" />
      <span className="text-[15px] font-medium text-ink">You don&apos;t have access to this</span>
      <span className="max-w-sm text-sm text-mutedGray">{describeMissingPermission(permission)}</span>
      {action}
    </div>
  );
};
