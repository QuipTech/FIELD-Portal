"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/selectInput";
import { KnowledgeClassificationFields } from "@/components/knowledge/knowledgeClassificationFields";
import { KnowledgeModelFields } from "@/components/knowledge/knowledgeModelFields";
import { updateKnowledgeMetadataRequest } from "@/lib/api/knowledgeBrandsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { knowledgeDocumentTypes, type KnowledgeDocument } from "@/lib/types/adminDocument";
import type { KnowledgeClassification } from "@/lib/types/knowledgeBrand";

export const DocumentMetadataModal = ({
  document,
  onClose,
  onSaved,
}: {
  document: KnowledgeDocument;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [value, setValue] = useState<KnowledgeClassification>({
    brandId: document.brandId ?? "",
    categoryId: document.categoryId ?? "",
    machineModelIds: document.machineModelIds ?? [],
  });
  const [type, setType] = useState(document.documentType ?? document.type);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateKnowledgeMetadataRequest(requireAccessToken(), document.id, { ...value, documentType: type });
      onSaved();
      onClose();
    } catch (failure) {
      setError(toApiErrorMessage(failure, "Couldn't update document."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Move or edit document" onClose={busy ? undefined : onClose} widthClassName="w-[540px]">
      <form onSubmit={save} className="flex flex-col gap-4 p-5">
        <p className="text-sm text-bodyGray">{document.title}</p>
        <KnowledgeClassificationFields value={value} onChange={setValue} required />
        <label className="flex flex-col gap-1 text-xs text-bodyGray">
          Document type
          <SelectInput value={type} onChange={(event) => setType(event.target.value)}>
            {!knowledgeDocumentTypes.some((option) => option.value === type) && <option value={type}>{type}</option>}
            {knowledgeDocumentTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </label>
        <KnowledgeModelFields
          value={value.machineModelIds ?? []}
          onChange={(ids) => setValue({ ...value, machineModelIds: ids })}
        />
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy || !value.brandId || !value.categoryId}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Modal>
  );
};
