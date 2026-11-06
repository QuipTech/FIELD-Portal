"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SelectInput } from "@/components/ui/selectInput";
import { UploadProgressBar } from "@/components/uploads/uploadProgressBar";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { formatFileSize } from "@/lib/format/fileSize";
import { DOCUMENT_ACCEPT, MACHINE_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, machineDocumentTypeLabels, type MachineDocumentType } from "@/lib/types/machineDocument";
import { useMultiFilePicker } from "@/lib/uploads/useFilePicker";

interface UploadDocumentDialogProps {
  machineLabel: string;
  onUpload: (file: File, documentType: MachineDocumentType, onProgress: (fraction: number) => void) => Promise<void>;
  // How many went up, once the upload run ends (some may have failed).
  onFinished: (uploadedCount: number) => void;
  onClose: () => void;
}

interface FileProblem {
  file: File;
  message: string;
}

const TOO_LARGE_MESSAGE = "Must be 20 MB or smaller.";

// One type for the files chosen. Files upload one at a time; any that fail
// stay listed with the reason, so they can be retried or removed.
export const UploadDocumentDialog = ({ machineLabel, onUpload, onFinished, onClose }: UploadDocumentDialogProps) => {
  const [documentType, setDocumentType] = useState<MachineDocumentType>("service_report");
  const [files, setFiles] = useState<File[]>([]);
  const [problems, setProblems] = useState<FileProblem[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [hasTried, setHasTried] = useState(false);
  const isUploading = progress !== null;
  const picker = useMultiFilePicker(DOCUMENT_ACCEPT, (picked) => setFiles((current) => [...current, ...picked]));
  const messageFor = (file: File) =>
    problems.find((problem) => problem.file === file)?.message ?? (file.size > MAX_DOCUMENT_BYTES ? TOO_LARGE_MESSAGE : null);

  const upload = async () => {
    setHasTried(true);
    if (files.length === 0 || files.some((file) => file.size > MAX_DOCUMENT_BYTES)) return;
    const failed: FileProblem[] = [];
    setProblems([]);
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setProgress(index / files.length);
      try {
        await onUpload(file, documentType, (fraction) => setProgress((index + fraction) / files.length));
      } catch (error) {
        failed.push({ file, message: toApiErrorMessage(error, "Couldn't upload this file.") });
      }
    }
    setProgress(null);
    onFinished(files.length - failed.length);
    if (failed.length === 0) {
      onClose();
      return;
    }
    setFiles(failed.map((problem) => problem.file));
    setProblems(failed);
  };

  return (
    <Modal title={`Upload documents — ${machineLabel}`} onClose={isUploading ? undefined : onClose} widthClassName="w-[520px]">
      <div className="flex flex-col gap-3.5 p-5">
        <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-mutedGray">
          Document type
          <SelectInput value={documentType} disabled={isUploading} onChange={(event) => setDocumentType(event.target.value as MachineDocumentType)}>
            {MACHINE_DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {machineDocumentTypeLabels[type]}
              </option>
            ))}
          </SelectInput>
        </label>
        <div className="flex flex-col gap-1.5">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex flex-col gap-0.5 rounded-lg border border-borderGrayStrong px-2.5 py-1.5">
              <div className="flex items-center gap-2 text-[13px] text-ink">
                <Icon name="file" className="h-4 w-4 flex-none stroke-mutedGray" />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="flex-none text-xs text-mutedGray">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  disabled={isUploading}
                  onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                  className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-bodyGray hover:bg-fillGray disabled:opacity-50"
                >
                  <Icon name="x" className="h-3 w-3" />
                </button>
              </div>
              {messageFor(file) && <span role="alert" className="text-xs text-danger">{messageFor(file)}</span>}
            </div>
          ))}
          <div>
            <Button type="button" size="sm" disabled={isUploading} onClick={picker.open}>
              <Icon name="plus" className="h-3.5 w-3.5" />
              Choose files
            </Button>
          </div>
          <span className="text-xs text-mutedGray">PDF, Word, JPG, PNG or HEIC, up to 20 MB each.</span>
          {hasTried && files.length === 0 && <span role="alert" className="text-xs text-danger">Choose at least one file.</span>}
          {picker.input}
        </div>
        {isUploading && <UploadProgressBar fraction={progress} />}
        <div className="flex">
          <Button type="button" variant="ghost" disabled={isUploading} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" className="ml-auto" disabled={isUploading} onClick={() => void upload()}>
            <Icon name="upload" />
            {isUploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
