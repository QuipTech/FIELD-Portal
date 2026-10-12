import Link from "next/link";
import { Icon, type IconName } from "@/components/icons/icon";
import { toneChipClasses, type Tone } from "@/components/ui/tone";
import { formatElapsedTime } from "@/lib/format/elapsedTimeLabel";
import type { NotificationKind, UserNotification } from "@/lib/types/notifications";

const KIND_STYLES: Record<NotificationKind, { icon: IconName; tone: Tone }> = {
  case_message: { icon: "msg", tone: "primary" },
  case_assigned: { icon: "life", tone: "amber" },
  case_status: { icon: "life", tone: "default" },
  case_priority: { icon: "alert", tone: "amber" },
  machine_status: { icon: "truck", tone: "danger" },
  ai_review: { icon: "spark", tone: "primary" },
  knowledge_document: { icon: "book", tone: "default" },
  alert: { icon: "alert", tone: "danger" },
};

interface NotificationListItemProps {
  notification: UserNotification;
  onOpen: (notification: UserNotification) => void;
}

export const NotificationListItem = ({ notification, onOpen }: NotificationListItemProps) => {
  const style = KIND_STYLES[notification.kind] ?? KIND_STYLES.case_status;
  const isUnread = !notification.isRead;

  return (
    <Link
      href={notification.link}
      onClick={() => onOpen(notification)}
      className={`flex items-start gap-3 border-b border-borderGray px-4 py-3 last:border-b-0 hover:bg-fillGray/60 ${
        isUnread ? "bg-primaryTint/40" : ""
      }`}
    >
      <span className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg ${toneChipClasses[style.tone]}`}>
        <Icon name={style.icon} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`text-[15px] text-ink ${isUnread ? "font-medium" : ""}`}>{notification.title}</span>
        {notification.body && <span className="line-clamp-2 text-sm text-bodyGray">{notification.body}</span>}
        <span className="text-xs text-mutedGray">{formatElapsedTime(new Date(notification.createdAt))}</span>
      </div>
      {isUnread && <span aria-label="Unread" className="mt-2 h-2.5 w-2.5 flex-none rounded-full bg-primary" />}
    </Link>
  );
};
