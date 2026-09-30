"use client";

import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import type { KnowledgeLibraryFilters } from "@/lib/types/knowledgeLibrary";
import { useKnowledgeLibrary } from "../useKnowledgeLibrary";
import { KnowledgeFilterNav } from "./knowledgeFilterNav";
import { KnowledgeFilterPills } from "./knowledgeFilterPills";
import { KnowledgeResultCard } from "./knowledgeResultCard";
import { KnowledgeSearchBar } from "./knowledgeSearchBar";
import { OrganisationDocuments } from "./organisationDocuments";

export const KnowledgeLibraryView = ({ initialFilters }: { initialFilters: KnowledgeLibraryFilters }) => {
  const { filters, updateFilter, results, hasSearch } = useKnowledgeLibrary(initialFilters);
  const data = results.data;
  const isNarrowed = hasSearch || Boolean(filters.type || filters.make || filters.model);

  const renderResults = () => {
    if (!data) {
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
    return data.items.map((result) => <KnowledgeResultCard key={result.id} result={result} />);
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
        <KnowledgeSearchBar value={filters.search} onChange={(search) => updateFilter("search", search)} />
        <KnowledgeFilterPills
          sort={filters.sort}
          hasSearch={hasSearch}
          activeModel={data?.activeModel ?? null}
          total={data?.total ?? null}
          searchMode={data?.searchMode ?? null}
          onSortChange={(sort) => updateFilter("sort", sort)}
          onClearModel={() => updateFilter("model", "")}
        />
        <OrganisationDocuments />
        {results.error && <p className="text-sm text-danger">{results.error}</p>}
        {renderResults()}
      </main>
    </>
  );
};
