"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { AddMachineModal } from "./addMachineModal";

export const AddMachineButton = ({ onRegistered }: { onRegistered: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <PermissionButton
        permission={PERMISSIONS.registerMachine}
        variant="primary"
        className="ml-auto"
        onClick={() => setIsOpen(true)}
      >
        <Icon name="plus" />
        Add machine
      </PermissionButton>
      {isOpen && <AddMachineModal onClose={() => setIsOpen(false)} onRegistered={onRegistered} />}
    </>
  );
};
