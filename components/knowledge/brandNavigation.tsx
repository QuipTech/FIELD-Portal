"use client";

import { Tag } from "@/components/ui/tag";
import { useKnowledgeBrands, useKnowledgeCategories } from "@/lib/knowledge/knowledgeBrandStore";
import { categoryOptions } from "@/lib/knowledge/categoryOptions";

interface Props {
  brandId: string;
  categoryId: string;
  onChange: (brandId: string, categoryId: string) => void;
}
export const BrandNavigation = ({ brandId, categoryId, onChange }: Props) => {
  // Loading these with the page also preloads the upload and filter dropdowns.
  const brands = useKnowledgeBrands();
  const categories = useKnowledgeCategories(brandId);
  const tabClass = (active: boolean) =>
    `flex-none whitespace-nowrap rounded-lg px-3 py-2 text-sm ${active ? "bg-primaryTint font-medium text-primaryTintText" : "text-bodyGray hover:bg-surfaceGray"}`;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <nav
        aria-label="Filter by Knowledge brand"
        className="flex gap-1 overflow-x-auto border-b border-borderGray pb-2"
      >
        <button type="button" aria-pressed={!brandId} className={tabClass(!brandId)} onClick={() => onChange("", "")}>
          All brands
        </button>
        {(brands.data ?? []).map((brand) => (
          <button
            type="button"
            key={brand.id}
            aria-pressed={brandId === brand.id}
            className={tabClass(brandId === brand.id)}
            onClick={() => onChange(brand.id, "")}
          >
            {brand.name}
            <span className="ml-2 text-xs opacity-70">{brand.documentCount}</span>
          </button>
        ))}
      </nav>
      {brandId && !categories.isLoading && !categories.error && (
        <nav aria-label="Category folders" className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={!categoryId}
            className={tabClass(!categoryId)}
            onClick={() => onChange(brandId, "")}
          >
            All folders
          </button>
          {categoryOptions((categories.data ?? []).filter((category) => category.brandId === brandId)).map(
            (category) => (
              <button
                type="button"
                key={category.id}
                aria-pressed={categoryId === category.id}
                className={tabClass(categoryId === category.id)}
                onClick={() => onChange(brandId, category.id)}
              >
                ▱ {category.label}
              </button>
            ),
          )}
        </nav>
      )}
      {(brandId || categoryId) && (
        <div className="flex flex-wrap gap-2">
          {brandId && (
            <Tag tone="primary">
              {brands.data?.find((brand) => brand.id === brandId)?.name ?? "Brand"}
              <button type="button" aria-label="Clear brand filter" onClick={() => onChange("", "")}>
                ×
              </button>
            </Tag>
          )}
          {categoryId && (
            <Tag tone="primary">
              {categories.data?.find((category) => category.id === categoryId)?.name ?? "Category"}
              <button type="button" aria-label="Clear category filter" onClick={() => onChange(brandId, "")}>
                ×
              </button>
            </Tag>
          )}
        </div>
      )}
      {(brands.error || categories.error) && (
        <p role="alert" className="text-xs text-danger">
          {brands.error || categories.error}
        </p>
      )}
    </div>
  );
};
