"use client";

import { useState } from "react";
import { saveKnowledgeCategoryRequest, deleteKnowledgeCategoryRequest } from "@/lib/api/knowledgeBrandsApi";
import { refreshKnowledgeCategories, useKnowledgeCategories } from "@/lib/knowledge/knowledgeBrandStore";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { categoryOptions } from "@/lib/knowledge/categoryOptions";
import { SavedToast } from "@/components/ui/savedToast";
import { CategoryList } from "./categoryList";
import { CategoryForm } from "./categoryForm";
import type { KnowledgeCategoryInput } from "@/lib/types/knowledgeBrand";

const EMPTY_CATEGORY: KnowledgeCategoryInput = { name: "", slug: "", parentId: null, sortOrder: 0 };
interface Target {
  key: number;
  editingId?: string;
  initial: KnowledgeCategoryInput;
}
export const CategoryManager = ({ brandId, brandName }: { brandId: string; brandName: string }) => {
  const categories = useKnowledgeCategories(brandId);
  const options = categoryOptions(categories.data ?? []);
  const [target, setTarget] = useState<Target>({ key: 0, initial: EMPTY_CATEGORY });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = (initial: KnowledgeCategoryInput, editingId?: string) => {
    setError(null);
    setTarget((current) => ({ key: current.key + 1, editingId, initial }));
  };
  const save = async (value: KnowledgeCategoryInput) => {
    setBusy(true);
    setError(null);
    try {
      await saveKnowledgeCategoryRequest(requireAccessToken(), brandId, value, target.editingId);
      setSaved(target.editingId ? `"${value.name}" updated` : `"${value.name}" added`);
      // Keep adding into the same folder, which is how folders are usually filled.
      open({ ...EMPTY_CATEGORY, parentId: target.editingId ? null : value.parentId });
      void refreshKnowledgeCategories(brandId);
    } catch (failure) {
      setError(toApiErrorMessage(failure, "Couldn't save category."));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Delete the "${name}" folder? It must be empty.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteKnowledgeCategoryRequest(requireAccessToken(), brandId, id);
      if (target.editingId === id) open(EMPTY_CATEGORY);
      setSaved(`"${name}" deleted`);
      void refreshKnowledgeCategories(brandId);
    } catch (failure) {
      setError(toApiErrorMessage(failure, "Couldn't delete category."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-borderGray p-4">
      <div>
        <h2 className="font-medium text-ink">Category folders</h2>
        <p className="text-xs text-mutedGray">
          {options.length
            ? `${options.length} folder${options.length === 1 ? "" : "s"} in ${brandName}`
            : `Folders organise ${brandName} documents`}
        </p>
      </div>
      {categories.error && <p className="text-xs text-danger">{categories.error}</p>}
      <CategoryList
        categories={options}
        editingId={target.editingId}
        busy={busy}
        onAddSubfolder={(parent) => open({ ...EMPTY_CATEGORY, parentId: parent.id })}
        onEdit={(category) => open(category, category.id)}
        onDelete={(category) => void remove(category.id, category.name)}
      />
      <CategoryForm
        key={target.key}
        initial={target.initial}
        editingId={target.editingId}
        categories={options}
        busy={busy}
        error={error}
        onSave={(value) => void save(value)}
        onCancel={() => open(EMPTY_CATEGORY)}
      />
      {saved && <SavedToast message={saved} onDismiss={() => setSaved(null)} />}
    </section>
  );
};
