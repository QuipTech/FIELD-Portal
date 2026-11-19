"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PermissionView } from "@/components/auth/permissionView";
import { RemoteSessionViewer } from "@/components/remoteSession/remoteSessionViewer";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";

interface RemoteSessionPageProps {
  params: { machineId: string };
}

// Opened as its own small window from a machine's Machine app tab; outside
// the app shell so the tablet's screen gets the whole window.
const RemoteSessionWindow = ({ machineId }: { machineId: string }) => {
  const label = useSearchParams().get("label") ?? "";
  return <RemoteSessionViewer machineId={machineId} machineLabel={label} />;
};

const RemoteSessionPage = ({ params }: RemoteSessionPageProps) => (
  <PermissionView permission={PERMISSIONS.useMachineControlRemote} className="h-screen bg-surfaceGray">
    <Suspense fallback={null}>
      <RemoteSessionWindow machineId={decodeURIComponent(params.machineId)} />
    </Suspense>
  </PermissionView>
);

export default RemoteSessionPage;
