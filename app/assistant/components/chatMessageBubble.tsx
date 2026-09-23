import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/types/chatMessage";

export const ChatMessageBubble = ({ message }: { message: ChatMessage }) => {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[62%] rounded-2xl bg-indigo-50/60 p-4">
          {message.paragraphs.map((paragraph) => (
            <span key={paragraph} className="text-[15px] text-slate-800">{paragraph}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg bg-primaryTint text-primaryTintText">
        <Icon name="spark" />
      </span>
      <div className="flex flex-1 flex-col gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        {message.paragraphs.map((paragraph) => (
          <span key={paragraph} className="text-[15px] text-ink">{paragraph}</span>
        ))}
        {message.sources ? (
          <div className="flex gap-2">
            {message.sources.map((source) => (
              <Tag key={source.label} tone="primary">
                <Icon name={source.icon} className="h-3.5 w-3.5" />
                {source.label}
              </Tag>
            ))}
          </div>
        ) : null}
        {message.actions ? (
          <div className="flex gap-2">
            {message.actions.map((action) => (
              <Button key={action.label} size="sm">
                <Icon name={action.icon} className="h-3.5 w-3.5" />
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
