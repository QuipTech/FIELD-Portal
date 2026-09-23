import { Icon } from "@/components/icons/icon";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import type { CaseMessage } from "@/lib/types/caseMessage";

export const CaseMessageThread = ({ messages }: { messages: CaseMessage[] }) => {
  if (messages.length === 0) {
    return <p className="text-[15px] text-mutedGray">No messages yet on this case.</p>;
  }

  return (
    <>
      {messages.map((message) => (
        <div key={message.id} className="flex flex-col gap-2.5 rounded-xl border border-borderGray bg-white p-3.5">
          <div className="flex items-center gap-2.5">
            <Avatar initials={message.authorInitials} size="sm" />
            <span className="text-[15px] font-medium text-ink">{message.authorName}</span>
            <Tag tone={message.roleLabel === "Support" ? "primary" : "default"}>{message.roleLabel}</Tag>
            <span className="ml-auto text-xs text-mutedGray">{message.timestampLabel}</span>
          </div>
          <span className="text-[15px] text-bodyGray">{message.body}</span>
          {message.photoCount ? (
            <div className="flex gap-2">
              {Array.from({ length: message.photoCount }).map((_, index) => (
                <div
                  key={index}
                  className="flex h-14 w-[76px] items-center justify-center rounded-lg border border-borderGrayStrong bg-fillGray text-mutedGray"
                >
                  <Icon name="image" className="h-3.5 w-3.5" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </>
  );
};
