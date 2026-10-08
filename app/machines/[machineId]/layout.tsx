import type { ReactNode } from "react";
import { PermissionView } from "@/components/auth/permissionView";
import { LinkButton } from "@/components/ui/linkButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { MachineDetailShell } from "./components/machineDetailShell";

interface MachineDetailLayoutProps {
  children: ReactNode;
  params: { machineId: string };
}

// Every machine detail tab (components, history, configuration history)
// needs "View machines"; without it the whole screen becomes a notice.
// These screens have no navigation shell, hence the way back.
const MachineDetailLayout = ({ children, params }: MachineDetailLayoutProps) => {
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
      <MachineDetailShell machineId={decodeURIComponent(params.machineId)}>{children}</MachineDetailShell>
    </PermissionView>
  );
};

export default MachineDetailLayout;
