import { Icon } from "@/components/icons/icon";
import { assistantThreads } from "@/lib/mockData/assistant";

const activeThreadId = assistantThreads[0]?.id;

export const ThreadsRail = () => {
  return (
    <div className="flex w-52 flex-none flex-col gap-0.5 border-r border-borderGray bg-surface p-3">
      <span className="px-2.5 pb-2 pt-1 text-xs font-medium uppercase tracking-wide text-mutedGray">Threads</span>
      {assistantThreads.map((thread) => (
        <div
          key={thread.id}
          className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-[15px] ${
            thread.id === activeThreadId ? "bg-primaryTint font-medium text-primaryHover" : "text-bodyGray"
          }`}
        >
          <Icon
            name="msg"
            className={`mt-0.5 ${thread.id === activeThreadId ? "stroke-primary" : "stroke-mutedGray"}`}
          />
          <span className="leading-snug">{thread.title}</span>
        </div>
      ))}
    </div>
  );
};
