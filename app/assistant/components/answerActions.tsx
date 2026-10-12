"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { PermissionButton } from "@/components/auth/permissionButton";
import { HistoryEntryModal } from "@/components/machines/historyEntryModal";
import { NewCaseModal } from "@/components/supportCases/newCaseModal";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { machineDetailService } from "@/lib/api/machineDetail/machineDetailService";
import { useComponentOptions } from "@/lib/machineDetail/useComponentOptions";
import type { AssistantMachine, AssistantMessage, AssistantSource } from "@/lib/types/aiAssistant";
import { describeSource } from "../assistantSources";

const MAX_FORM_TEXT = 5000;
const CASE_SUBJECT_MAX = 200;

interface AnswerActionsProps {
  message: AssistantMessage;
  citedSources: AssistantSource[];
  // The technician's question this message answers.
  question: string;
  machine: AssistantMachine | null;
  onOpenSource: (source: AssistantSource) => void;
}

const withSources = (text: string, sources: AssistantSource[]) =>
  (sources.length ? `${text}\n\nSources: ${sources.map(describeSource).join("; ")}` : text).slice(0, MAX_FORM_TEXT);

// Open source · Log as entry (needs a machine context) · Raise case. The
// entry and case forms open prefilled from the answer, to edit before saving.
export const AnswerActions = ({ message, citedSources, question, machine, onOpenSource }: AnswerActionsProps) => {
  const [openForm, setOpenForm] = useState<"entry" | "case" | null>(null);
  const firstSource = citedSources.find((source) => source.documentId);
  const componentOptions = useComponentOptions(machineDetailService, machine?.id ?? null, openForm === "entry");

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={!firstSource} onClick={() => firstSource && onOpenSource(firstSource)}>
        <Icon name="ext" className="h-3.5 w-3.5" />
        Open source
      </Button>
      <span title={machine ? undefined : "Start a thread with a machine context to log this on its history."}>
        <PermissionButton
          permission={PERMISSIONS.addHistoryEntry}
          size="sm"
          disabled={!machine}
          onClick={() => setOpenForm("entry")}
        >
          <Icon name="file" className="h-3.5 w-3.5" />
          Log as entry
        </PermissionButton>
      </span>
      <PermissionButton permission={PERMISSIONS.raiseSupportCase} size="sm" onClick={() => setOpenForm("case")}>
        <Icon name="life" className="h-3.5 w-3.5" />
        Raise case
      </PermissionButton>
      {openForm === "entry" && machine && (
        <HistoryEntryModal
          machineLabel={machine.label}
          componentOptions={componentOptions}
          defaultHours={null}
          initialDescription={withSources(message.content, citedSources)}
          onSubmit={async (entry) => {
            await machineDetailService.createHistoryEntry(machine.id, entry);
            setOpenForm(null);
          }}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't save the entry. Please try again.")}
          onClose={() => setOpenForm(null)}
        />
      )}
      {openForm === "case" && (
        <NewCaseModal
          initialDraft={{
            subject: question.slice(0, CASE_SUBJECT_MAX),
            category: "ai_answer",
            machineId: machine?.id ?? "",
            description: withSources(`Question: ${question}\n\nAI answer:\n${message.content}`, citedSources),
          }}
          onClose={() => setOpenForm(null)}
        />
      )}
    </div>
  );
};
