"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons/icon";
import { usePermissions } from "@/lib/auth/usePermissions";
import { describeMissingPermission, type PermissionCode } from "@/lib/auth/permissionCodes";

interface PermissionButtonProps extends ComponentProps<typeof Button> {
  permission: PermissionCode;
}

// A Button the user always sees, but can only press with `permission`.
// Without it the button shows a lock and explains why on hover. The
// wrapper carries the tooltip because disabled buttons don't fire hover
// events in every browser; layout classes (e.g. ml-auto) go on it too.
export const PermissionButton = ({ permission, className = "", disabled, children, ...props }: PermissionButtonProps) => {
  const { isLoaded, can } = usePermissions();
  const isDenied = isLoaded && !can(permission);

  return (
    <span title={isDenied ? describeMissingPermission(permission) : undefined} className={`inline-flex ${className}`}>
      <Button {...props} disabled={disabled || !isLoaded || isDenied} aria-disabled={isDenied || undefined}>
        {isDenied && <Icon name="lock" className="h-3.5 w-3.5" />}
        {children}
      </Button>
    </span>
  );
};
