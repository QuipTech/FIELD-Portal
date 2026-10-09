"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { Icon } from "@/components/icons/icon";
import { ErrorToast } from "@/components/ui/errorToast";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { EMPTY_MACHINE_FILTERS, listMachinesRequest } from "@/lib/api/machineFleetApi";
import type { AssistantSource } from "@/lib/types/aiAssistant";
import { useAssistantThreads } from "../useAssistantThreads";
import { useAskAssistant } from "../useAskAssistant";
import { openSourceDocument } from "../assistantSources";
import { readAssistantLaunchParams } from "../readAssistantLaunchParams";
import { ThreadsRail } from "./threadsRail";
import { ChatMessageList } from "./chatMessageList";
import { ChatComposer } from "./chatComposer";
import { MachineContextPicker } from "./machineContextPicker";
import { DocumentContextTag } from "./documentContextTag";

const TITLE_MAX_LENGTH = 80;

export const AssistantWorkspace = () => {
  const threads = useAssistantThreads();
  const machines = useApiResource((token) => listMachinesRequest(token, EMPTY_MACHINE_FILTERS, ""), [], "Couldn't load machines.");
  const [newThreadMachineId, setNewThreadMachineId] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [launchPrompt, setLaunchPrompt] = useState("");
  const [sourceDocument, setSourceDocument] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    const { machineId, prompt, document } = readAssistantLaunchParams();
    if (machineId) setNewThreadMachineId(machineId);
    if (prompt) setLaunchPrompt(prompt);
    setSourceDocument(document);
  }, []);
  const { activeThread } = threads;
  const newThreadMachine = machines.data?.items.find((machine) => machine.id === newThreadMachineId);
  const contextMachine = activeThread
    ? activeThread.machine
    : newThreadMachine
      ? { id: newThreadMachine.id, label: newThreadMachine.label }
      : null;

  const asker = useAskAssistant({
    activeThread,
    machineId: newThreadMachineId,
    documentId: sourceDocument?.id ?? null,
    onDocumentUsed: () => setSourceDocument(null),
    setMessages: threads.setMessages,
    onThreadSaved: (conversationId, question) =>
      threads.adoptThread({
        id: conversationId,
        title: activeThread?.title ?? question.slice(0, TITLE_MAX_LENGTH),
        machine: contextMachine,
        updatedAt: new Date().toISOString(),
      }),
  });

  const openSource = (source: AssistantSource) =>
    openSourceDocument(source).catch((error: unknown) =>
      setToastMessage(toApiErrorMessage(error, "Couldn't open that document.")),
    );

  const errorMessage = asker.askError ?? toastMessage;
  const dismissError = () => {
    asker.clearAskError();
    setToastMessage(null);
  };

  return (
    <AppShell
      topBar={
        <TopBar
          showUserMenu={false}
          actions={
            <>
              {sourceDocument && <DocumentContextTag title={sourceDocument.title} onClear={() => setSourceDocument(null)} />}
              <MachineContextPicker
                fixedMachine={activeThread?.machine ?? null}
                isThreadOpen={activeThread !== null}
                machines={machines.data?.items ?? []}
                value={newThreadMachineId}
                onChange={setNewThreadMachineId}
              />
              <PermissionButton
                permission={PERMISSIONS.useAiAssistant}
                size="sm"
                onClick={() => {
                  asker.cancel();
                  setSourceDocument(null);
                  threads.startNewThread();
                }}
              >
                <Icon name="plus" className="h-3.5 w-3.5" />
                New thread
              </PermissionButton>
            </>
          }
        >
          <span className="text-[15px] text-bodyGray">AI assistant</span>
        </TopBar>
      }
    >
      <div className="m-4 flex flex-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-surface">
        <ThreadsRail
          threads={threads.threads}
          activeThreadId={activeThread?.id ?? null}
          isLoading={threads.isLoadingThreads}
          error={threads.threadsError}
          onSelect={(thread) => {
            asker.cancel();
            void threads.openThread(thread);
          }}
        />
        <main className="flex min-w-0 flex-1 flex-col gap-3.5 p-5">
          <ChatMessageList
            messages={threads.messages}
            machine={contextMachine}
            isLoading={threads.isLoadingMessages}
            error={threads.messagesError}
            onOpenSource={openSource}
          />
          <ChatComposer
            onAsk={asker.ask}
            isAnswering={asker.isAnswering}
            hasMachineContext={contextMachine !== null}
            prefill={launchPrompt}
          />
          <p className="text-xs text-mutedGray">Answers always cite sources; no source = no answer.</p>
        </main>
      </div>
      {errorMessage && <ErrorToast key={errorMessage} message={errorMessage} onDismiss={dismissError} />}
    </AppShell>
  );
};
