import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { FilterChipSelect } from "@/components/ui/filterChipSelect";
import type { LibrarySearchMode, LibrarySort } from "@/lib/types/knowledgeLibrary";

interface KnowledgeFilterPillsProps {
  sort: LibrarySort;
  hasSearch: boolean;
  activeModel: { id: string; name: string } | null;
  total: number | null;
  searchMode: LibrarySearchMode | null;
  onSortChange: (sort: LibrarySort) => void;
  onClearModel: () => void;
}

const SORT_OPTIONS: { value: LibrarySort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
];

export const KnowledgeFilterPills = ({
  sort,
  hasSearch,
  activeModel,
  total,
  searchMode,
  onSortChange,
  onClearModel,
}: KnowledgeFilterPillsProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasSearch && (
        <FilterChipSelect
          label="Sort"
          value={sort}
          options={SORT_OPTIONS}
          onChange={(value) => onSortChange(value as LibrarySort)}
        />
      )}
      {activeModel && (
        <Tag tone="primary">
          {activeModel.name}
          <button type="button" aria-label={`Remove ${activeModel.name} filter`} onClick={onClearModel} className="flex-none">
            <Icon name="x" className="h-3.5 w-3.5" />
          </button>
        </Tag>
      )}
      {searchMode === "keyword" && (
        <span className="text-xs text-mutedGray" title="AI search isn't available right now">
          Keyword matches
        </span>
      )}
      {total !== null && (
        <span className="ml-auto text-xs text-mutedGray">
          {total.toLocaleString()} {total === 1 ? "result" : "results"}
        </span>
      )}
    </div>
  );
};
