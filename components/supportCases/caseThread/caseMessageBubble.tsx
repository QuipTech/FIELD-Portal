import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { abbreviateName, getInitials } from "@/lib/format/nameInitials";
import type { CaseAuthorRole, CaseMessage } from "@/lib/types/caseMessage";
import { CaseAttachmentList } from "./caseAttachmentList";
import { formatMessageTimestamp } from "./messageTimestamp";

const FORMER_USER_NAME = "Former user";

const ROLE_LABELS: Record<CaseAuthorRole, string> = {
  customer: "Customer",
  assignee: "Support",
  admin: "Admin",
  system: "FIELD",
};

// Whose screen the thread is on: each side sees its own messages on the right.
export type ThreadPerspective = "customer" | "staff";

const bubbleClasses = (message: CaseMessage, isOwnSide: boolean) => {
  if (message.isInternal) return "border-amberBorder bg-amberTint text-ink";
  return isOwnSide ? "border-primaryBorder bg-primaryTint text-primaryTintText" : "border-borderGray bg-surface text-ink";
};

interface CaseMessageBubbleProps {
  message: CaseMessage;
  // Shown beside the customer's name, e.g. "QuipTech Mining · Customer".
  companyName?: string;
  perspective: ThreadPerspective;
}

// Like any chat, your side's messages sit on the right, highlighted: the
// customer's on their screen, staff replies on the admin screen. Staff are
// labelled Support or Admin; internal notes (staff only) are amber.
export const CaseMessageBubble = ({ message, companyName, perspective }: CaseMessageBubbleProps) => {
  const isCustomer = message.authorRole === "customer";
  const isOwnSide = (perspective === "customer") === isCustomer;
  const authorName = message.author?.name || FORMER_USER_NAME;
  const roleMeta = [isCustomer ? companyName : undefined, ROLE_LABELS[message.authorRole]].filter(Boolean).join(" · ");

  return (
    <div className={`flex flex-col gap-2 ${isOwnSide ? "items-end" : "items-start"}`}>
      <div className={`flex items-center gap-2.5 text-sm ${isOwnSide ? "flex-row-reverse" : ""}`}>
        <Avatar initials={getInitials(authorName)} imageSrc={message.author?.avatarUrl ?? undefined} size="md" />
        <span className="text-[15px] font-medium text-ink">{abbreviateName(authorName)}</span>
        {message.isInternal && <Tag tone="amber">Internal note</Tag>}
        <span className="text-mutedGray">{roleMeta}</span>
        <span className="text-mutedGray">{formatMessageTimestamp(message.createdAt)}</span>
      </div>
      <div className={`flex max-w-[75%] flex-col gap-3 rounded-xl border px-5 py-4 shadow-sm ${bubbleClasses(message, isOwnSide)}`}>
        <span className="whitespace-pre-wrap text-[16px] leading-relaxed">{message.body}</span>
        <CaseAttachmentList attachments={message.attachments} />
      </div>
    </div>
  );
};
