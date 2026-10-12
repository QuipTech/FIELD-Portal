"use client";

import { useRef } from "react";
import { Icon, type IconName } from "@/components/icons/icon";
import type { PendingCaseUpload } from "@/lib/hooks/useCaseAttachmentUploads";

// What the API accepts (CASE_ATTACHMENT_RULE): photos and PDF/Word documents.
const PHOTO_TYPES = "image/jpeg,image/png,image/heic,.heic";
const DOCUMENT_TYPES = "application/pdf,.pdf,.doc,.docx";

interface CaseAttachmentPickerProps {
  uploads: PendingCaseUpload[];
  onAdd: (files: FileList) => void;
  onRemove: (key: string) => void;
  disabled?: boolean;
}

const PickerButton = ({ icon, label, accept, disabled, onAdd }: {
  icon: IconName;
  label: string;
  accept: string;
  disabled: boolean;
  onAdd: (files: FileList) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-fillGray text-bodyGray hover:bg-borderGray disabled:opacity-50"
      >
        <Icon name={icon} className="h-4 w-4" />
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) onAdd(event.target.files);
          event.target.value = "";
        }}
      />
    </>
  );
};

// Attach a photo or a document, plus a chip per picked file showing its
// upload progress.
export const CaseAttachmentPicker = ({ uploads, onAdd, onRemove, disabled = false }: CaseAttachmentPickerProps) => (
  <div className="flex flex-wrap items-center gap-2">
    <PickerButton icon="image" label="Attach photos" accept={PHOTO_TYPES} disabled={disabled} onAdd={onAdd} />
    <PickerButton icon="file" label="Attach a document" accept={DOCUMENT_TYPES} disabled={disabled} onAdd={onAdd} />
    {uploads.map((upload) => (
      <span
        key={upload.key}
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
          upload.error ? "border-dangerBorder bg-dangerTint text-danger" : "border-borderGray bg-fillGray text-bodyGray"
        }`}
        title={upload.error ?? upload.fileName}
      >
        <Icon name={upload.error ? "alert" : "file"} className="h-3 w-3" />
        <span className="max-w-[140px] truncate">{upload.fileName}</span>
        {!upload.attachment && !upload.error && <span>{Math.round(upload.progress * 100)}%</span>}
        <button type="button" aria-label={`Remove ${upload.fileName}`} onClick={() => onRemove(upload.key)}>
          <Icon name="x" className="h-3 w-3" />
        </button>
      </span>
    ))}
  </div>
);
