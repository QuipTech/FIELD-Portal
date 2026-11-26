"use client";

import { useState } from "react";
import { PermissionButton } from "@/components/auth/permissionButton";
import { Icon } from "@/components/icons/icon";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { openRemoteSessionWindow, remoteSessionWindowUrl } from "@/lib/remoteSession/remoteSessionWindow";

interface RemoteSessionButtonProps {
  machineId: string;
  machineLabel: string;
  tabletOnline: boolean;
  hasFieldId: boolean;
}

// Opens the remote session in its own small window, which asks the tablet
// and runs the session. One window per machine: clicking again focuses it.
export const RemoteSessionButton = ({ machineId, machineLabel, tabletOnline, hasFieldId }: RemoteSessionButtonProps) => {
  const [blocked, setBlocked] = useState(false);
  const open = () =>
    setBlocked(!openRemoteSessionWindow(remoteSessionWindowUrl(machineId, machineLabel, hasFieldId), `field-remote-${machineId}`));
  return (
    <div className="flex flex-col items-start gap-1.5">
      <PermissionButton permission={PERMISSIONS.useMachineControlRemote} variant="primary" onClick={open} disabled={!tabletOnline}>
        <Icon name="broadcast" />
        Connect to Remote Session
      </PermissionButton>
      {!tabletOnline && <span className="text-xs text-mutedGray">The tablet needs to be online with the FIELD Machine app open.</span>}
      {blocked && (
        <span role="alert" className="text-xs text-danger">
          Your browser blocked the remote session window. Allow pop-ups for this site and try again.
        </span>
      )}
    </div>
  );
};
