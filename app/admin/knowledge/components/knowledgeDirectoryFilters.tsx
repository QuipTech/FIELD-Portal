"use client";

import { KnowledgeClassificationFields } from "@/components/knowledge/knowledgeClassificationFields";
import { SelectInput } from "@/components/ui/selectInput";
import { Input } from "@/components/ui/input";
import { knowledgeDocumentTypes } from "@/lib/types/adminDocument";
import { listMachineModelsRequest } from "@/lib/api/machineLibraryApi";
import { useApiResource } from "@/lib/hooks/useApiResource";

export interface KnowledgeDirectoryFilters {
  brandId: string;
  categoryId: string;
  type: string;
  status: string;
  search: string;
  machineModelId: string;
}
export const EMPTY_KNOWLEDGE_FILTERS: KnowledgeDirectoryFilters = {
  brandId: "",
  categoryId: "",
  type: "",
  status: "",
  search: "",
  machineModelId: "",
};
export const KnowledgeDirectoryFilterBar = ({
  value,
  onChange,
}: {
  value: KnowledgeDirectoryFilters;
  onChange: (value: KnowledgeDirectoryFilters) => void;
}) => {
  const models = useApiResource((token) => listMachineModelsRequest(token, ""), [], "Couldn't load models.");
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-borderGray p-3">
      <KnowledgeClassificationFields
        value={value}
        onChange={(classification) => onChange({ ...value, ...classification })}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          aria-label="Search documents"
          icon="search"
          placeholder="Search documents"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
        />
        <SelectInput
          aria-label="Document type"
          value={value.type}
          onChange={(event) => onChange({ ...value, type: event.target.value })}
        >
          <option value="">All document types</option>
          {knowledgeDocumentTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          aria-label="Document status"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value })}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="needs_review">Needs review</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </SelectInput>
        <SelectInput
          aria-label="Machine model"
          value={value.machineModelId}
          onChange={(event) => onChange({ ...value, machineModelId: event.target.value })}
        >
          <option value="">All machine models</option>
          {(models.data ?? []).map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
            </option>
          ))}
        </SelectInput>
      </div>
    </div>
  );
};
