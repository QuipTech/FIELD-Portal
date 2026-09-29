"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { getDeletionRequestRequest, requestAccountDeletionRequest } from "@/lib/api/myDataApi";
import { formatShortDate } from "@/lib/format/shortDate";

// Sends a deletion request to the organisation's admin (it shows in their
// audit log). Nothing is deleted straight away, and asset/configuration
// records belong to the company's CMDB, so they're never part of it.
export const DeleteAccountButton = () => {
  const pending = useApiResource(getDeletionRequestRequest, [], "Couldn't check your deletion request.");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsSending(true);
    setSendError(null);
    try {
      pending.setData(await requestAccountDeletionRequest(requireAccessToken()));
      setIsConfirming(false);
    } catch (error) {
      setSendError(toApiErrorMessage(error, "Couldn't send your request. Please try again."));
    } finally {
      setIsSending(false);
    }
  };

  if (pending.data?.status === "pending") {
    return (
      <span className="text-xs text-mutedGray">Deletion requested {formatShortDate(pending.data.requestedAt)}</span>
    );
  }

  return (
    <>
      <Button size="sm" variant="danger" onClick={() => setIsConfirming(true)} disabled={pending.isLoading}>
        Request deletion
      </Button>
      {isConfirming && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-inkStatic/40">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Request account deletion"
            className="flex w-[380px] flex-col items-center gap-4 rounded-2xl bg-surface p-6 text-center"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-dangerTint text-danger">
              <Icon name="alert" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-[17px] font-medium text-ink">Request account deletion?</h2>
              <p className="text-[13px] text-mutedGray">
                Your administrator is notified and will remove your profile and sign-in. Asset and configuration records
                belong to your company&apos;s CMDB and are not deleted with your account.
              </p>
            </div>
            {sendError && <span className="text-center text-xs text-danger">{sendError}</span>}
            <div className="flex w-full gap-2">
              <Button className="flex-1" disabled={isSending} onClick={() => setIsConfirming(false)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" disabled={isSending} onClick={handleConfirm}>
                {isSending ? "Sending…" : "Request deletion"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
