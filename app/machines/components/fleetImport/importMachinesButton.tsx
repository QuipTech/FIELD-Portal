"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { FleetImportModal } from "./fleetImportModal";

export const ImportMachinesButton = ({ onImported }: { onImported: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <PermissionButton permission={PERMISSIONS.registerMachine} onClick={() => setIsOpen(true)}>
        <Icon name="upload" />
        Import CSV
      </PermissionButton>
      {isOpen && <FleetImportModal onImported={onImported} onClose={() => setIsOpen(false)} />}
    </>
  );
};
