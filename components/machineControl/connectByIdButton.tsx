"use client";

import { useState } from "react";
import { PermissionButton } from "@/components/auth/permissionButton";
import { Icon } from "@/components/icons/icon";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { CONNECT_BY_ID_URL, openRemoteSessionWindow } from "@/lib/remoteSession/remoteSessionWindow";

// Opens the window that takes a FIELD ID and password and connects.
export const ConnectByIdButton = () => {
  const [blocked, setBlocked] = useState(false);
  return (
    <>
      <PermissionButton
        permission={PERMISSIONS.useMachineControlRemote}
        onClick={() => setBlocked(!openRemoteSessionWindow(CONNECT_BY_ID_URL, "field-remote-connect"))}
      >
        <Icon name="broadcast" />
        Connect by ID
      </PermissionButton>
      {blocked && (
        <span role="alert" className="text-xs text-danger">
          Allow pop-ups for this site and try again.
        </span>
      )}
    </>
  );
};
