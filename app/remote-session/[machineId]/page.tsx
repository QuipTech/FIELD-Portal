"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PermissionView } from "@/components/auth/permissionView";
import { RemoteConnectForm } from "@/components/remoteSession/remoteConnectForm";
import { RemoteSessionViewer } from "@/components/remoteSession/remoteSessionViewer";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import type { RemoteSession } from "@/lib/types/remoteSession";

interface RemoteSessionPageProps {
  params: { machineId: string };
}

// Opened as its own small window from a machine's Machine app tab; outside
// the app shell so the tablet's screen gets the whole window. A tablet with a
// FIELD ID asks for its password first.
const RemoteSessionWindow = ({ machineId }: { machineId: string }) => {
  const query = useSearchParams();
  const label = query.get("label") ?? "";
  const [session, setSession] = useState<RemoteSession | null>(null);
  if (query.get("password") && !session) {
    return <RemoteConnectForm machineId={machineId} machineLabel={label} onStarted={setSession} />;
  }
  return <RemoteSessionViewer machineId={machineId} machineLabel={label} startedSession={session ?? undefined} />;
};

const RemoteSessionPage = ({ params }: RemoteSessionPageProps) => (
  <PermissionView permission={PERMISSIONS.useMachineControlRemote} className="h-screen bg-surfaceGray">
    <Suspense fallback={null}>
      <RemoteSessionWindow machineId={decodeURIComponent(params.machineId)} />
    </Suspense>
  </PermissionView>
);

export default RemoteSessionPage;
