"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { SelectInput } from "@/components/ui/selectInput";
import { buttonBaseClasses, buttonSizeClasses, buttonVariantClasses } from "@/components/ui/buttonStyles";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { DemoRequest, DemoRequestStatus, DemoRequestUpdate, ResendEmailsResult } from "@/lib/types/demoRequest";
import { STATUS_OPTIONS, fullName, replyMailtoHref } from "../demoRequestLabels";
import { DemoRequestDetails } from "./demoRequestDetails";

interface DemoRequestDrawerProps {
  request: DemoRequest;
  onSave: (requestId: string, update: DemoRequestUpdate) => Promise<DemoRequest>;
  onResendEmails: (requestId: string) => Promise<ResendEmailsResult>;
  onClose: () => void;
}

const SAVE_FAILED_MESSAGE = "Couldn't save the changes. Please try again.";
const RESEND_FAILED_MESSAGE = "Couldn't resend the emails. Please try again.";
const fieldLabelClasses = "text-xs font-medium uppercase tracking-wide text-mutedGray";
const replyButtonClasses = `${buttonBaseClasses} ${buttonVariantClasses.primary} ${buttonSizeClasses.md}`;

const describeResend = ({ teamEmailSent, userEmailSent }: ResendEmailsResult) =>
  teamEmailSent && userEmailSent ? "Both emails have been sent." : "Some emails still didn't send. Check the API logs.";

export const DemoRequestDrawer = ({ request, onSave, onResendEmails, onClose }: DemoRequestDrawerProps) => {
  const [current, setCurrent] = useState(request);
  const [status, setStatus] = useState<DemoRequestStatus>(request.status);
  const [notes, setNotes] = useState(request.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; isError: boolean } | null>(null);
  const isDirty = status !== current.status || notes.trim() !== (current.notes ?? "");
  const hasUnsentEmail = !current.teamEmailSentAt || !current.userEmailSentAt;

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);
    try {
      const saved = await onSave(current.id, { status, notes: notes.trim() });
      setCurrent(saved);
      setNotes(saved.notes ?? "");
      setNotice({ text: "Changes saved.", isError: false });
    } catch (error) {
      setNotice({ text: toApiErrorMessage(error, SAVE_FAILED_MESSAGE), isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setNotice(null);
    try {
      const result = await onResendEmails(current.id);
      setCurrent(result.request);
      setNotice({ text: describeResend(result), isError: !(result.teamEmailSent && result.userEmailSent) });
    } catch (error) {
      setNotice({ text: toApiErrorMessage(error, RESEND_FAILED_MESSAGE), isError: true });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Drawer title={`${fullName(current)} · ${current.company}`} onClose={onClose}>
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-wrap gap-2">
          <a href={replyMailtoHref(current)} className={replyButtonClasses}>
            <Icon name="mail" />
            Reply by email
          </a>
          <Button onClick={handleResend} disabled={!hasUnsentEmail || isResending}>
            <Icon name="send" />
            {isResending ? "Sending…" : "Resend emails"}
          </Button>
        </div>
        <DemoRequestDetails request={current} />
        <form onSubmit={handleSave} className="flex flex-col gap-3.5 border-t border-borderGray pt-5">
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelClasses}>Status</span>
            <SelectInput value={status} onChange={(event) => setStatus(event.target.value as DemoRequestStatus)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelClasses}>Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Calls, agreed demo time, who's following up…"
              rows={5}
              maxLength={5000}
              className="rounded-lg border border-borderGrayStrong bg-surface p-3 text-[15px] text-ink outline-none placeholder:text-mutedGray"
            />
          </label>
          {notice && <span className={`text-xs ${notice.isError ? "text-danger" : "text-mutedGray"}`}>{notice.text}</span>}
          <div className="flex">
            <Button type="submit" variant="primary" className="ml-auto" disabled={!isDirty || isSaving}>
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </Drawer>
  );
};
