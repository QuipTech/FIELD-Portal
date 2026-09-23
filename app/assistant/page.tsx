import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { activeThreadMessages } from "@/lib/mockData/assistant";
import { ThreadsRail } from "./components/threadsRail";
import { ChatMessageBubble } from "./components/chatMessageBubble";
import { ChatComposer } from "./components/chatComposer";

const AssistantPage = () => {
  return (
    <AppShell
      topBar={
        <TopBar
          showThemeToggle={false}
          showUserMenu={false}
          actions={
            <>
              <Tag tone="primary">
                <Icon name="truck" className="h-3.5 w-3.5" />
                Context: HT-2201
              </Tag>
              <Button size="sm">
                <Icon name="plus" className="h-3.5 w-3.5" />
                New thread
              </Button>
            </>
          }
        >
          <span className="text-[15px] text-bodyGray">AI assistant</span>
        </TopBar>
      }
    >
      <div className="m-4 flex flex-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <ThreadsRail />
        <main className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-5">
          {activeThreadMessages.map((message) => (
            <ChatMessageBubble key={message.id} message={message} />
          ))}
          <ChatComposer />
          <p className="text-xs text-mutedGray">Answers always cite sources; no source = no answer.</p>
        </main>
      </div>
    </AppShell>
  );
};

export default AssistantPage;
