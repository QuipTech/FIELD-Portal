import { Icon } from "@/components/icons/icon";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { toneTagClasses } from "@/components/ui/tone";
import type { AssistantMachine, AssistantSource, ChatEntry } from "@/lib/types/aiAssistant";
import { describeSource, findCitedSources } from "../assistantSources";
import { AnswerText } from "./answerText";
import { AnswerActions } from "./answerActions";

interface ChatMessageBubbleProps {
  message: ChatEntry;
  // For answers: the question they answer, and the thread's machine.
  question?: string;
  machine: AssistantMachine | null;
  onOpenSource: (source: AssistantSource) => void;
}

const UserBubble = ({ message }: { message: ChatEntry }) => (
  <div className="flex justify-end">
    <div className="flex max-w-[62%] flex-col gap-2 rounded-2xl bg-primarySoft p-4">
      {message.imagePreviewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a local data URL, not an optimisable asset
        <img src={message.imagePreviewUrl} alt="Attached photo" className="max-h-48 w-fit rounded-lg object-contain" />
      )}
      <span className="whitespace-pre-wrap text-[15px] text-slate-800">{message.content}</span>
    </div>
  </div>
);

export const ChatMessageBubble = ({ message, question = "", machine, onOpenSource }: ChatMessageBubbleProps) => {
  if (message.role === "user") return <UserBubble message={message} />;

  const citedSources = findCitedSources(message);
  const isWaiting = message.isStreaming && !message.content;

  return (
    <div className="flex gap-3">
      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg bg-primaryTint text-primaryTintText">
        <Icon name="spark" />
      </span>
      <div className="flex flex-1 flex-col gap-2.5 rounded-2xl border border-slate-200/80 bg-surface p-6 shadow-sm">
        {isWaiting ? (
          <span className="flex items-center gap-2 text-sm text-mutedGray">
            <LoadingSpinner /> Checking the manuals…
          </span>
        ) : (
          <AnswerText text={message.content} />
        )}
        {citedSources.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {citedSources.map((source) => (
              <button
                key={source.index}
                type="button"
                disabled={!source.documentId}
                onClick={() => onOpenSource(source)}
                title={source.heading ?? undefined}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-60 ${toneTagClasses.primary}`}
              >
                <Icon name="book" className="h-3.5 w-3.5" />
                {source.index} · {describeSource(source)}
              </button>
            ))}
          </div>
        )}
        {!message.isStreaming && (
          <AnswerActions
            message={message}
            citedSources={citedSources}
            question={question}
            machine={machine}
            onOpenSource={onOpenSource}
          />
        )}
      </div>
    </div>
  );
};
