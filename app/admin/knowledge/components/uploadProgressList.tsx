import { Button } from "@/components/ui/button";
import type { UploadProgress } from "../useKnowledgeUploads";

interface UploadProgressListProps {
  uploads: UploadProgress[];
  onClearFinished: () => void;
}

const describeUpload = (upload: UploadProgress) => {
  if (upload.status === "done") return "Uploaded — queued for indexing";
  if (upload.status === "failed") return upload.errorMessage;
  return `Uploading ${Math.round(upload.fraction * 100)}%`;
};

export const UploadProgressList = ({ uploads, onClearFinished }: UploadProgressListProps) => {
  if (uploads.length === 0) return null;
  const hasFinished = uploads.some((upload) => upload.status !== "uploading");

  return (
    <div className="flex flex-none flex-col gap-2 rounded-lg border border-borderGray p-3">
      {uploads.map((upload) => (
        <div key={upload.id} className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="truncate font-medium text-ink">{upload.fileName}</span>
            <span className={`ml-auto flex-none ${upload.status === "failed" ? "text-danger" : "text-mutedGray"}`}>
              {describeUpload(upload)}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-fillGray">
            <div
              className={`h-full transition-all ${upload.status === "failed" ? "bg-danger" : "bg-primary"}`}
              style={{ width: `${Math.round(upload.fraction * 100)}%` }}
            />
          </div>
        </div>
      ))}
      {hasFinished && (
        <Button variant="ghost" size="sm" className="self-end" onClick={onClearFinished}>
          Clear finished
        </Button>
      )}
    </div>
  );
};
