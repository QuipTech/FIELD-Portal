"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { ErrorToast } from "@/components/ui/errorToast";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { CaseHeaderBar } from "@/components/supportCases/caseHeaderBar";
import { CaseThread } from "@/components/supportCases/caseThread/caseThread";
import { CaseThreadSkeleton } from "@/components/supportCases/caseThread/caseThreadSkeleton";
import { CaseComposer } from "@/components/supportCases/caseComposer";
import { useSignedInProfile } from "@/lib/auth/useSignedInProfile";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { SupportCaseChanges } from "@/lib/types/supportCase";
import { useAdminCase } from "../useAdminCase";
import { canMarkWaiting, canResolve, staffReplyClosedReason } from "../staffCaseRules";
import { AdminCaseSidePanel } from "./adminCaseSidePanel";

// A13b: one case for staff — the shared thread (with internal notes) and
// the case's controls.
export const AdminCaseView = ({ caseNumber }: { caseNumber: number }) => {
  const { supportCase, thread, updateCase } = useAdminCase(caseNumber);
  const profile = useSignedInProfile();
  const [toast, setToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const item = supportCase.data;

  const change = async (changes: SupportCaseChanges) => {
    setIsSaving(true);
    await updateCase(changes)
      .catch((error: unknown) => setToast(toApiErrorMessage(error, "Couldn't save that change.")))
      .finally(() => setIsSaving(false));
  };

  const headerActions = item && (
    <>
      {canMarkWaiting(item) && (
        <Button disabled={isSaving} onClick={() => change({ status: "waiting_on_customer" })}>
          Mark waiting on customer
        </Button>
      )}
      {canResolve(item) && (
        <Button variant="primary" disabled={isSaving} onClick={() => change({ status: "resolved" })}>
          <Icon name="check" />
          Resolve
        </Button>
      )}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CaseHeaderBar
        backHref="/admin/cases"
        backLabel="Support cases"
        caseNumber={caseNumber}
        item={item}
        audience="staff"
        isLive={thread.isLive}
        actions={headerActions}
      />
      {!item ? (
        <div className="flex flex-1 items-center justify-center text-mutedGray">
          {supportCase.isLoading ? (
            <LoadingSpinner size="md" />
          ) : (
            <p className="text-sm">
              {supportCase.error ?? "This case doesn't exist."}{" "}
              <Link href="/admin/cases" className="text-primary hover:underline">
                Back to support cases
              </Link>
            </p>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col bg-surfaceGray">
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {thread.isLoading ? (
                <CaseThreadSkeleton />
              ) : (
                <CaseThread
                  messages={thread.messages}
                  events={thread.events}
                  perspective="staff"
                  companyName={item.company.name}
                />
              )}
              {thread.error && <p className="mt-3 text-sm text-danger">{thread.error}</p>}
            </div>
            <CaseComposer
              scope="staff"
              caseNumber={caseNumber}
              typingName={thread.typingName}
              replyClosedReason={staffReplyClosedReason(item)}
              canAddInternalNotes={item.status !== "closed"}
              onSend={thread.sendMessage}
              onTyping={thread.noteTyping}
              onError={setToast}
            />
          </main>
          <AdminCaseSidePanel
            item={item}
            currentUserId={profile?.user.id ?? null}
            isSaving={isSaving}
            onChange={change}
          />
        </div>
      )}
      {toast && <ErrorToast key={toast} message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
};
