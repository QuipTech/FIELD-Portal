"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { getCasePriorityTone } from "@/lib/format/casePriority";
import { CASE_STATUS_LABELS, formatCaseNumber } from "@/lib/format/caseLabels";
import { useCaseThread } from "../useCaseThread";
import { CaseMessageThread } from "./caseMessageThread";
import { CaseReplyBox } from "./caseReplyBox";
import { CaseDetailsRail } from "./caseDetailsRail";

export const CaseThreadView = ({ caseNumber }: { caseNumber: number }) => {
  const { supportCase, messages, typingName, isLive, sendReply, updateCase, noteTyping } = useCaseThread(caseNumber);
  const item = supportCase.data;

  return (
    <div className="flex h-screen flex-col bg-surfaceGray">
      <div className="flex flex-none items-center gap-2.5 border-b border-slate-200/80 bg-surface px-6 py-4">
        <Link href="/cases" className="text-[15px] text-bodyGray">
          Cases
        </Link>
        <Icon name="chevr" className="stroke-mutedGray" />
        <span className="text-[15px] font-medium text-ink">
          {formatCaseNumber(caseNumber)} {item?.subject}
        </span>
        {item && (
          <div className="ml-auto flex items-center gap-2.5">
            <span
              className={`flex items-center gap-1.5 text-xs ${isLive ? "text-bodyGray" : "text-mutedGray"}`}
              title={isLive ? "New replies appear automatically" : "Reconnecting…"}
            >
              <span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-500" : "bg-slate-300"}`} />
              {isLive ? "Live" : "Offline"}
            </span>
            <Tag tone={getCasePriorityTone(item.priority)}>
              {CASE_STATUS_LABELS[item.status]} · {item.priority}
            </Tag>
          </div>
        )}
      </div>
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
            <main className="flex flex-[2.2] flex-col gap-3.5 overflow-y-auto p-3">
              {messages.error ? (
                <p className="text-sm text-danger">{messages.error}</p>
              ) : (
                <CaseMessageThread messages={messages.data ?? []} />
              )}
              <CaseReplyBox
                status={item.status}
                typingName={typingName}
                onSend={sendReply}
                onTyping={noteTyping}
                onStatusChange={(status) => updateCase({ status })}
              />
            </main>
            <CaseDetailsRail item={item} onChange={updateCase} />
          </div>
        )}
      </div>
    </div>
  );
};
