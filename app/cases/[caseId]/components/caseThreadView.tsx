"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorToast } from "@/components/ui/errorToast";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { CaseThread } from "@/components/supportCases/caseThread/caseThread";
import { CaseThreadSkeleton } from "@/components/supportCases/caseThread/caseThreadSkeleton";
import { CaseComposer } from "@/components/supportCases/caseComposer";
import { CaseHeaderBar } from "@/components/supportCases/caseHeaderBar";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { useCaseThread } from "../useCaseThread";
import { CaseInfoPanel } from "./caseInfoPanel";
import { isReopenable, replyClosedReason } from "./customerCaseRules";

export const CaseThreadView = ({ caseNumber }: { caseNumber: number }) => {
  const { supportCase, thread, reopen } = useCaseThread(caseNumber);
  const [toast, setToast] = useState<string | null>(null);
  const [isReopening, setIsReopening] = useState(false);
  const item = supportCase.data;

  const handleReopen = async () => {
    setIsReopening(true);
    await reopen()
      .catch((error: unknown) => setToast(toApiErrorMessage(error, "Couldn't reopen the case.")))
      .finally(() => setIsReopening(false));
  };

  return (
    <div className="flex h-screen flex-col bg-surfaceGray">
      <CaseHeaderBar
        backHref="/cases"
        backLabel="Cases"
        caseNumber={caseNumber}
        item={item}
        audience="customer"
        isLive={thread.isLive}
        actions={
          item && isReopenable(item) ? (
            <Button size="sm" onClick={handleReopen} disabled={isReopening}>
              Reopen
            </Button>
          ) : null
        }
      />
      <div className="flex min-h-0 flex-1">
        {!item ? (
          <div className="flex flex-1 items-center justify-center text-mutedGray">
            {supportCase.isLoading ? (
              <LoadingSpinner size="md" />
            ) : (
              <p className="text-sm">
                {supportCase.error ?? "This case doesn't exist."}{" "}
                <Link href="/cases" className="text-primary hover:underline">
                  Back to cases
                </Link>
              </p>
            )}
          </div>
        ) : (
          <div className="m-4 flex flex-1 gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-surface p-3">
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-surfaceGray">
              <div className="flex-1 overflow-y-auto px-6 py-6">
                {thread.isLoading ? <CaseThreadSkeleton /> : <CaseThread messages={thread.messages} events={thread.events} perspective="customer" />}
                {thread.error && <p className="mt-3 text-sm text-danger">{thread.error}</p>}
              </div>
              <CaseComposer
                scope="customer"
                caseNumber={caseNumber}
                typingName={thread.typingName}
                replyClosedReason={replyClosedReason(item)}
                onSend={thread.sendMessage}
                onTyping={thread.noteTyping}
                onError={setToast}
              />
            </main>
            <CaseInfoPanel item={item} />
          </div>
        )}
      </div>
      {toast && <ErrorToast key={toast} message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
};
