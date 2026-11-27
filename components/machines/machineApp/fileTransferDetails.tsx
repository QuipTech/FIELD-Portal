import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import type { Tone } from "@/components/ui/tone";
import type { DesignStatus } from "@/lib/api/machineDesignApi";
import { formatFileSize } from "@/lib/format/fileSize";
import type { FileTransferSummary } from "@/lib/types/tabletFiles";

const STATUS: Record<DesignStatus, { label: string; tone: Tone }> = {
  waiting: { label: "Waiting", tone: "default" },
  downloading: { label: "Downloading", tone: "amber" },
  arrived: { label: "Arrived", tone: "ok" },
  failed: { label: "Failed", tone: "danger" },
};

export const FileTransferStatusTag = ({ status }: { status: DesignStatus }) => (
  <Tag tone={STATUS[status].tone}>{STATUS[status].label}</Tag>
);

// The files of one send to a tablet, with where it stands.
export const FileTransferDetails = ({ transfer, caption }: { transfer: FileTransferSummary; caption?: string }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex flex-wrap items-center gap-2">
      <FileTransferStatusTag status={transfer.status} />
      {caption && <span className="text-xs text-mutedGray">{caption}</span>}
    </div>
    <ul className="flex flex-col gap-1">
      {transfer.files.map((file) => (
        <li key={file.name} className="flex items-center gap-2 text-xs">
          <Icon name="file" className="h-3.5 w-3.5 flex-none text-mutedGray" />
          <span className="min-w-0 flex-1 truncate text-ink" title={file.name}>
            {file.name}
          </span>
          <span className="tabular-nums text-mutedGray">{formatFileSize(file.sizeBytes)}</span>
        </li>
      ))}
    </ul>
    {transfer.error && <span className="text-xs text-danger">{transfer.error}</span>}
  </div>
);
