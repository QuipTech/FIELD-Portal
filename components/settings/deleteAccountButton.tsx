"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { Input } from "@/components/ui/input";
import { deleteAccountRequest, getDeletionEligibilityRequest } from "@/lib/api/accountApi";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { endLocalSession } from "@/lib/auth/endLocalSession";

const CONFIRMATION_WORD = "DELETE";

// Permanently deletes the signed-in user's account, then signs them out.
// Asset and configuration records belong to the company's CMDB, so they
// stay — just no longer attributed to this user. The organisation's last
// Owner sees why they can't instead of the button.
export const DeleteAccountButton = () => {
  const router = useRouter();
  const eligibility = useApiResource(getDeletionEligibilityRequest, [], "Couldn't check your account.");
  const [isConfirming, setIsConfirming] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState("");

  const closeDialog = () => {
    setIsConfirming(false);
    setTypedConfirmation("");
  };

  const deleteAccount = async () => {
    await deleteAccountRequest(requireAccessToken());
    await endLocalSession(() => router.replace("/login"));
  };

  if (eligibility.data && !eligibility.data.canDelete) {
    return <span className="max-w-[320px] text-right text-xs text-mutedGray">{eligibility.data.blockedReason}</span>;
  }

  return (
    <>
      <Button size="sm" variant="danger" onClick={() => setIsConfirming(true)} disabled={eligibility.isLoading}>
        Delete account
      </Button>
      {isConfirming && (
        <ConfirmDialog
          title="Delete your account?"
          confirmLabel="Delete account"
          onConfirm={deleteAccount}
          onClose={closeDialog}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't delete your account. Please try again.")}
          isConfirmDisabled={typedConfirmation.trim() !== CONFIRMATION_WORD}
        >
          <div className="flex flex-col gap-3">
            <p>
              This permanently removes your profile, sign-in and AI conversations, and signs you out. It can&apos;t be
              undone. Asset and configuration records belong to your company&apos;s CMDB and are kept.
            </p>
            <p>
              Type <span className="font-medium text-ink">{CONFIRMATION_WORD}</span> to confirm.
            </p>
            <Input
              aria-label={`Type ${CONFIRMATION_WORD} to confirm`}
              value={typedConfirmation}
              onChange={(event) => setTypedConfirmation(event.target.value)}
              autoComplete="off"
            />
          </div>
        </ConfirmDialog>
      )}
    </>
  );
};
