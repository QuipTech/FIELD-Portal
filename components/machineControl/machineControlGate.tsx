"use client";

import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/emptyState";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { PERMISSIONS, describeMissingPermission } from "@/lib/auth/permissionCodes";
import { usePermissions } from "@/lib/auth/usePermissions";
import { MachineControlOffNotice } from "./machineControlOffNotice";

// The module, once the organisation has it on and the person may see it. The
// API checks the same; this only explains instead of showing errors.
export const MachineControlGate = ({ children }: { children: ReactNode }) => {
  const { isLoaded, can, machineControlEnabled } = usePermissions();
  if (!isLoaded) {
    return (
      <div className="flex justify-center py-16 text-mutedGray">
        <LoadingSpinner size="md" />
      </div>
    );
  }
  if (!machineControlEnabled) return <MachineControlOffNotice />;
  if (!can(PERMISSIONS.viewMachineControl)) {
    return <EmptyState icon="lock" title="No access to Machine Control" description={describeMissingPermission(PERMISSIONS.viewMachineControl)} />;
  }
  return <>{children}</>;
};
