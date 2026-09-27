"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { findKnowledgeFileProblem, titleFromFileName } from "@/lib/format/knowledgeUploadFile";
import { knowledgeDocumentTypes, type KnowledgeDocumentType } from "@/lib/types/adminDocument";
import type { PendingUpload } from "../useKnowledgeUploads";

interface UploadDocumentsModalProps {
  files: File[];
  onUpload: (uploads: PendingUpload[], type: KnowledgeDocumentType) => void;
  onClose: () => void;
}

// Files that break the upload rules are listed with the reason and left out.
export const UploadDocumentsModal = ({ files, onUpload, onClose }: UploadDocumentsModalProps) => {
  const [type, setType] = useState<KnowledgeDocumentType>("manual");
  const [pending, setPending] = useState<PendingUpload[]>(() =>
    files.filter((file) => !findKnowledgeFileProblem(file)).map((file) => ({ file, title: titleFromFileName(file.name) })),
  );
  const rejected = files.filter((file) => findKnowledgeFileProblem(file));
  const canUpload = pending.length > 0 && pending.every((item) => item.title.trim());

  const renameUpload = (index: number, title: string) =>
    setPending((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, title } : item)));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canUpload) return;
    onUpload(pending.map((item) => ({ ...item, title: item.title.trim() })), type);
    onClose();
  };

  return (
    <Modal title="Upload documents" onClose={onClose} widthClassName="w-[520px]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Type</span>
          <div className="flex gap-2">
            {knowledgeDocumentTypes.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={type === option.value ? "primary" : "default"}
                onClick={() => setType(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        {pending.map((item, index) => (
          <div key={`${item.file.name}-${index}`} className="flex flex-col gap-1.5">
            <span className="truncate text-xs text-mutedGray">{item.file.name}</span>
            <Input value={item.title} onChange={(event) => renameUpload(index, event.target.value)} maxLength={300} required />
          </div>
        ))}
        {rejected.map((file) => (
          <span key={file.name} className="text-xs text-danger">
            {file.name}: {findKnowledgeFileProblem(file)}
          </span>
        ))}
        <span className="text-xs text-mutedGray">
          Shared with every organisation once indexed. Files go straight to secure storage.
        </span>
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="ml-auto" disabled={!canUpload}>
            Upload {pending.length} {pending.length === 1 ? "file" : "files"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
