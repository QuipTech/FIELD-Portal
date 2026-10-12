import { TopBar } from "@/components/shell/topBar";
import { knowledgeDocumentTypes, type KnowledgeDocumentType } from "@/lib/types/adminDocument";
import type { KnowledgeLibraryFilters } from "@/lib/types/knowledgeLibrary";
import { KnowledgeLibraryView } from "./components/knowledgeLibraryView";

interface KnowledgeSearchPageProps {
  // e.g. /knowledge?model=<machine model id>&q=suspension
  searchParams: { q?: string; type?: string; make?: string; model?: string };
}

const toDocumentType = (value: string | undefined): KnowledgeDocumentType | "" =>
  knowledgeDocumentTypes.find((option) => option.value === value)?.value ?? "";

const KnowledgeSearchPage = ({ searchParams }: KnowledgeSearchPageProps) => {
  const initialFilters: KnowledgeLibraryFilters = {
    search: searchParams.q ?? "",
    type: toDocumentType(searchParams.type),
    make: searchParams.make ?? "",
    model: searchParams.model ?? "",
    sort: "relevance",
  };

  return (
    <div className="flex h-screen flex-col bg-surfaceGray">
      <TopBar>
        <span className="text-[15px] text-bodyGray">Knowledge</span>
      </TopBar>
      <div className="flex min-h-0 flex-1">
        <div className="m-4 flex flex-1 gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-surface p-3">
          <KnowledgeLibraryView initialFilters={initialFilters} />
        </div>
      </div>
    </div>
  );
};

export default KnowledgeSearchPage;
