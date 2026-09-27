"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { useDeleteAccount } from "@/lib/auth/useDeleteAccount";
import { signOutOfCognito } from "@/lib/auth/cognitoFederatedSignIn";

type DeleteStage = "idle" | "confirm" | "done";

export const DeleteAccountButton = () => {
  const router = useRouter();
  const [stage, setStage] = useState<DeleteStage>("idle");
  const { deleteAccount, isDeleting, errorMessage } = useDeleteAccount();

  const handleConfirmDelete = async () => {
    const deleted = await deleteAccount();
    if (deleted) setStage("done");
  };

  // Google/Apple users leave via Cognito's hosted-UI logout (which lands on
  // /login); for everyone else signOutOfCognito resolves and we push.
  const handleDone = async () => {
    await signOutOfCognito().catch(() => undefined);
    router.push("/login");
  };

  return (
    <>
      <Button size="sm" variant="danger" onClick={() => setStage("confirm")}>
        Request deletion
      </Button>

      {stage === "confirm" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-inkStatic/40">
          <div className="flex w-[380px] flex-col items-center gap-4 rounded-2xl bg-surface p-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-dangerTint text-danger">
              <Icon name="alert" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-[17px] font-medium text-ink">Delete your account?</h2>
              <p className="text-[13px] text-mutedGray">
                This removes your profile and sign-in. Asset and configuration records stay on the tenant&apos;s
                CMDB. This can&apos;t be undone.
              </p>
            </div>
            {errorMessage && <span className="text-center text-xs text-danger">{errorMessage}</span>}
            <div className="flex w-full gap-2">
              <Button className="flex-1" disabled={isDeleting} onClick={() => setStage("idle")}>
                No, keep account
              </Button>
              <Button variant="danger" className="flex-1" disabled={isDeleting} onClick={handleConfirmDelete}>
                {isDeleting ? "Deleting…" : "Yes, delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-inkStatic/40">
          <div className="flex w-[380px] flex-col items-center gap-4 rounded-2xl bg-surface p-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primaryTint text-primary">
              <Icon name="check" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-[17px] font-medium text-ink">Your account has been terminated</h2>
              <p className="text-[13px] text-mutedGray">You&apos;ll be signed out and returned to sign-in.</p>
            </div>
            <Button variant="primary" className="w-full" onClick={handleDone}>
              Done
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
