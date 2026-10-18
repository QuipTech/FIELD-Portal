"use client";

import { listMachineModelsRequest } from "@/lib/api/machineLibraryApi";
import { useApiResource } from "@/lib/hooks/useApiResource";

export const KnowledgeModelFields = ({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) => {
  const models = useApiResource((token) => listMachineModelsRequest(token, ""), [], "Couldn't load machine models.");
  return (
    <fieldset className="flex flex-col gap-2 text-xs text-bodyGray">
      <legend className="mb-2">Linked machine models (optional)</legend>
      <div className="max-h-36 overflow-auto rounded-lg border border-borderGray p-3">
        {(models.data ?? []).map((model) => (
          <label key={model.id} className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              checked={value.includes(model.id)}
              onChange={(event) =>
                onChange(event.target.checked ? [...value, model.id] : value.filter((id) => id !== model.id))
              }
            />
            {model.displayName}
          </label>
        ))}
        {models.isLoading && <span>Loading models…</span>}
        {models.error && <span className="text-danger">{models.error}</span>}
      </div>
    </fieldset>
  );
};
