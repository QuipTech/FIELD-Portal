import { Icon } from "@/components/icons/icon";
import type { CaseAttachment } from "@/lib/types/caseMessage";

const KB = 1024;

const formatSize = (bytes: number) =>
  bytes >= KB * KB ? `${(bytes / (KB * KB)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / KB))} KB`;

const isImage = (attachment: CaseAttachment) => attachment.contentType.startsWith("image/");

// Photos as tiles, documents as download chips. Links are signed and
// expire, so a long-open thread may need a reload to open older files.
export const CaseAttachmentList = ({ attachments }: { attachments: CaseAttachment[] }) => {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2.5">
      {attachments.map((attachment) =>
        isImage(attachment) ? (
          <a
            key={attachment.id}
            href={attachment.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            title={attachment.fileName}
            className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-lg border border-borderGray bg-fillGray text-mutedGray"
          >
            {attachment.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={attachment.url} alt={attachment.fileName} className="h-full w-full object-cover" />
            ) : (
              <Icon name="image" />
            )}
          </a>
        ) : (
          <a
            key={attachment.id}
            href={attachment.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-borderGray bg-surface px-2.5 py-1.5 text-xs text-bodyGray hover:bg-fillGray"
          >
            <Icon name="file" className="h-3.5 w-3.5" />
            <span className="max-w-[180px] truncate">{attachment.fileName}</span>
            <span className="text-mutedGray">{formatSize(attachment.sizeBytes)}</span>
          </a>
        ),
      )}
    </div>
  );
};
