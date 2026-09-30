"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { NewCaseModal } from "./newCaseModal";

export const NewCaseButton = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <PermissionButton permission={PERMISSIONS.raiseSupportCase} variant="primary" onClick={() => setIsOpen(true)}>
        <Icon name="plus" />
        New case
      </PermissionButton>
      {isOpen && <NewCaseModal onClose={() => setIsOpen(false)} />}
    </>
  );
};
