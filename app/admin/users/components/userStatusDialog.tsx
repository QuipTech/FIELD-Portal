"use client";

import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { setUserStatusRequest } from "@/lib/api/adminUsersApi";
import type { AdminUser } from "@/lib/types/adminUser";

interface UserStatusDialogProps {
  user: AdminUser;
  // True when they were just disabled, false when enabled.
  onChanged: (isDisabled: boolean) => void;
  onClose: () => void;
}

// Users → Disable user / Enable user: blocks or restores sign-in without
// deleting anything (Remove user deletes the account).
export const UserStatusDialog = ({ user, onChanged, onClose }: UserStatusDialogProps) => {
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const isEnabling = user.status === "disabled";
  const action = isEnabling ? "Enable user" : "Disable user";
  return (
    <ConfirmDialog
      title={action}
      confirmLabel={action}
      onConfirm={async () => {
        await setUserStatusRequest(requireAccessToken(), user.id, isEnabling ? "active" : "disabled");
        onChanged(!isEnabling);
      }}
      onClose={onClose}
      toErrorMessage={(error) =>
        toApiErrorMessage(error, `Couldn't ${isEnabling ? "enable" : "disable"} this user. Please try again.`)
      }
    >
      <p className="text-[15px] text-bodyGray">
        {isEnabling ? "Enable" : "Disable"} <span className="font-medium text-ink">{fullName}</span> ({user.email}) in{" "}
        {user.organisation.name}?
      </p>
      <p className="text-sm text-mutedGray">
        {isEnabling
          ? "They can sign in again with their existing account, role and data."
          : "Their account and data are kept, but they're signed out and can't sign in. If they try, they're told an administrator disabled their account and to contact you. You can enable them again at any time."}
      </p>
    </ConfirmDialog>
  );
};
