"use client";

import { useKnowledgeBrands, useKnowledgeCategories } from "@/lib/knowledge/knowledgeBrandStore";
import { SelectInput } from "@/components/ui/selectInput";
import { categoryOptions } from "@/lib/knowledge/categoryOptions";
import type { KnowledgeClassification } from "@/lib/types/knowledgeBrand";

interface Props {
  value: KnowledgeClassification;
  onChange: (value: KnowledgeClassification) => void;
  required?: boolean;
}
export const KnowledgeClassificationFields = ({ value, onChange, required = false }: Props) => {
  // Cached for the tab and preloaded with the page, so these fill in instantly.
  const brands = useKnowledgeBrands();
  const categories = useKnowledgeCategories(value.brandId);
  const currentCategories = (categories.data ?? []).filter((category) => category.brandId === value.brandId);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex min-w-0 flex-col gap-1 text-xs text-bodyGray">
        Brand
        <SelectInput
          aria-label="Brand"
          required={required}
          value={value.brandId}
          onChange={(event) => onChange({ ...value, brandId: event.target.value, categoryId: "" })}
        >
          <option value="">{brands.isLoading ? "Loading brands…" : required ? "Choose brand" : "All brands"}</option>
          {(brands.data ?? []).map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
              {!required ? ` (${brand.documentCount})` : ""}
            </option>
          ))}
        </SelectInput>
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-xs text-bodyGray">
        Category
        <SelectInput
          aria-label="Category"
          required={required}
          disabled={!value.brandId || categories.isLoading}
          value={value.categoryId}
          onChange={(event) => onChange({ ...value, categoryId: event.target.value })}
        >
          <option value="">{required ? "Choose category" : "All categories"}</option>
          {categoryOptions(currentCategories).map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </SelectInput>
      </label>
      {(brands.error || categories.error) && <p className="text-xs text-danger">{brands.error || categories.error}</p>}
    </div>
  );
};
