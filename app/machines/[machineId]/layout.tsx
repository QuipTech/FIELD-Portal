import type { ReactNode } from "react";
import { PermissionView } from "@/components/auth/permissionView";
import { LinkButton } from "@/components/ui/linkButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";

// Every machine detail tab (components, history, configuration) needs
// "View machines"; without it the whole screen becomes a notice. These
// screens have no navigation shell, hence the way back.
const MachineDetailLayout = ({ children }: { children: ReactNode }) => {
  return (
    <PermissionView
      permission={PERMISSIONS.viewMachines}
      className="h-screen bg-surfaceGray"
      fallbackAction={
        <LinkButton href="/dashboard" variant="primary" className="mt-2">
          Back to dashboard
        </LinkButton>
      }
    >
      {children}
    </PermissionView>
  );
};

export default MachineDetailLayout;
