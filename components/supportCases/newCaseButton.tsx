"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import type { NewSupportCase } from "@/lib/types/supportCase";
import { NewCaseModal } from "./newCaseModal";

interface NewCaseButtonProps {
  // Prefills the form, e.g. the machine when raised from its Open cases tab.
  initialDraft?: Partial<NewSupportCase>;
  isMachineFixed?: boolean;
}

export const NewCaseButton = ({ initialDraft, isMachineFixed }: NewCaseButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <PermissionButton permission={PERMISSIONS.raiseSupportCase} variant="primary" onClick={() => setIsOpen(true)}>
        <Icon name="plus" />
        New case
      </PermissionButton>
      {isOpen && (
        <NewCaseModal onClose={() => setIsOpen(false)} initialDraft={initialDraft} isMachineFixed={isMachineFixed} />
      )}
    </>
  );
};
