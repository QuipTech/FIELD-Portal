"use client";

import { useState } from "react";
import { PermissionView } from "@/components/auth/permissionView";
import { RemoteConnectForm } from "@/components/remoteSession/remoteConnectForm";
import { RemoteSessionViewer } from "@/components/remoteSession/remoteSessionViewer";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import type { RemoteSession } from "@/lib/types/remoteSession";

// Connect with a tablet's FIELD ID and password; the machine follows from it.
const ConnectByIdWindow = () => {
  const [session, setSession] = useState<RemoteSession | null>(null);
  if (!session) return <RemoteConnectForm onStarted={setSession} />;
  return <RemoteSessionViewer machineId={session.machineId} machineLabel="" startedSession={session} />;
};

const ConnectByIdPage = () => (
  <PermissionView permission={PERMISSIONS.useMachineControlRemote} className="h-screen bg-surfaceGray">
    <ConnectByIdWindow />
  </PermissionView>
);

export default ConnectByIdPage;
