"use client";

import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { removeUserRequest } from "@/lib/api/adminUsersApi";
import type { AdminUser } from "@/lib/types/adminUser";

interface RemoveUserDialogProps {
  user: AdminUser;
  onRemoved: () => void;
  onClose: () => void;
}

// Users → Remove user: deletes the account for good.
export const RemoveUserDialog = ({ user, onRemoved, onClose }: RemoveUserDialogProps) => {
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  return (
    <ConfirmDialog
      title="Remove user"
      confirmLabel="Remove user"
      onConfirm={async () => {
        await removeUserRequest(requireAccessToken(), user.id);
        onRemoved();
      }}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't remove this user. Please try again.")}
    >
      <p className="text-[15px] text-bodyGray">
        Remove <span className="font-medium text-ink">{fullName}</span> ({user.email}) from {user.organisation.name}?
      </p>
      <p className="text-sm text-mutedGray">
        Their account and personal data are deleted and they&apos;re signed out. Records they created for the
        organisation (machine history, support cases) stay, without their name. If they try to sign in, they&apos;re
        told an administrator removed their account. You can invite them again later.
      </p>
    </ConfirmDialog>
  );
};
