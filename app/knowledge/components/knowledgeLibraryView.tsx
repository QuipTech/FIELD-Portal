"use client";

import { listKnowledgeModelsRequest } from "@/lib/api/knowledgeBrandsApi";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { Tag } from "@/components/ui/tag";
import { knowledgeDocumentTypes } from "@/lib/types/adminDocument";
import { BrandNavigation } from "@/components/knowledge/brandNavigation";
import { Pagination } from "@/components/ui/pagination";
import { SelectInput } from "@/components/ui/selectInput";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import type { KnowledgeLibraryFilters } from "@/lib/types/knowledgeLibrary";
import { knowledgeArticleNavigation, toListContext } from "@/lib/knowledge/knowledgeLinks";
import { useKnowledgeLibrary } from "../useKnowledgeLibrary";
import { KnowledgeFilterNav } from "./knowledgeFilterNav";
import { KnowledgeFilterPills } from "./knowledgeFilterPills";
import { KnowledgeResultCard } from "@/components/knowledge/knowledgeResultCard";
import { KnowledgeSearchBar } from "./knowledgeSearchBar";

export const KnowledgeLibraryView = ({ initialFilters }: { initialFilters: KnowledgeLibraryFilters }) => {
  const { filters, updateScope, updateFilter, results, hasSearch } = useKnowledgeLibrary(initialFilters);
  const models = useApiResource(listKnowledgeModelsRequest, [], "Couldn't load models.");
  const data = results.data;
  const isNarrowed =
    hasSearch || Boolean(filters.type || filters.make || filters.model || filters.brandId || filters.categoryId);
  const listContext = toListContext(filters);

  const renderResults = () => {
    if (!data || results.isLoading || results.error) {
      return results.isLoading ? (
        <div className="flex justify-center py-10 text-mutedGray">
          <LoadingSpinner size="md" />
        </div>
      ) : null;
    }
    if (data.items.length === 0) {
      return (
        <p className="py-10 text-center text-sm text-mutedGray">
          {isNarrowed
            ? "Nothing matches. Try other words or clear a filter."
            : "No searchable documents yet. Documents appear here once they're indexed and live."}
        </p>
      );
    }
    return data.items.map((result) => (
      <KnowledgeResultCard key={result.id} result={result} navigation={knowledgeArticleNavigation(listContext)} />
    ));
  };

  return (
    <>
      <KnowledgeFilterNav
        type={filters.type}
        make={filters.make}
        makes={data?.makes ?? []}
        onTypeChange={(type) => updateFilter("type", type)}
        onMakeChange={(make) => updateFilter("make", make)}
      />
      <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-2">
        <BrandNavigation brandId={filters.brandId ?? ""} categoryId={filters.categoryId ?? ""} onChange={updateScope} />
        <KnowledgeSearchBar value={filters.search} onChange={(search) => updateFilter("search", search)} />
        <SelectInput
          aria-label="Filter by machine model"
          value={filters.model}
          onChange={(event) => updateFilter("model", event.target.value)}
        >
          <option value="">All machine models</option>
          {(models.data ?? []).map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
            </option>
          ))}
        </SelectInput>
        {models.error && <p className="text-xs text-danger">{models.error}</p>}
        {filters.type && (
          <Tag tone="primary" className="w-fit">
            {knowledgeDocumentTypes.find((type) => type.value === filters.type)?.label ?? filters.type}
            <button type="button" aria-label="Clear document type filter" onClick={() => updateFilter("type", "")}>
              ×
            </button>
          </Tag>
        )}
        <KnowledgeFilterPills
          sort={filters.sort}
          hasSearch={hasSearch}
          activeModel={data?.activeModel ?? null}
          total={data?.total ?? null}
          searchMode={data?.searchMode ?? null}
          onSortChange={(sort) => updateFilter("sort", sort)}
          onClearModel={() => updateFilter("model", "")}
        />

        {results.error && <p className="text-sm text-danger">{results.error}</p>}
        {renderResults()}
        {!results.isLoading && !results.error && (
          <Pagination
            page={Number(filters.page ?? 1)}
            pageSize={50}
            total={data?.total ?? 0}
            onPageChange={(page) => updateFilter("page", String(page))}
          />
        )}
      </main>
    </>
  );
};
