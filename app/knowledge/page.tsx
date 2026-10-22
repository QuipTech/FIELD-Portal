import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { knowledgeDocumentTypes, type KnowledgeDocumentType } from "@/lib/types/adminDocument";
import type { KnowledgeLibraryFilters } from "@/lib/types/knowledgeLibrary";
import { KnowledgeLibraryView } from "./components/knowledgeLibraryView";

interface KnowledgeSearchPageProps {
  // e.g. /knowledge?model=<machine model id>&q=suspension
  searchParams: {
    q?: string;
    type?: string;
    make?: string;
    model?: string;
    brandId?: string;
    categoryId?: string;
    page?: string;
  };
}

const toDocumentType = (value: string | undefined): KnowledgeDocumentType | "" =>
  knowledgeDocumentTypes.find((option) => option.value === value)?.value ?? "";

const KnowledgeSearchPage = ({ searchParams }: KnowledgeSearchPageProps) => {
  const initialFilters: KnowledgeLibraryFilters = {
    brandId: searchParams.brandId ?? "",
    categoryId: searchParams.categoryId ?? "",
    page: searchParams.page ?? "1",
    search: searchParams.q ?? "",
    type: toDocumentType(searchParams.type),
    make: searchParams.make ?? "",
    model: searchParams.model ?? "",
    sort: "relevance",
  };

  return (
    <AppShell
      topBar={
        <TopBar>
          <span className="text-[15px] text-bodyGray">Knowledge</span>
        </TopBar>
      }
    >
      <div className="m-4 flex min-w-0 flex-1 gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-surface p-3">
        <KnowledgeLibraryView initialFilters={initialFilters} />
      </div>
    </AppShell>
  );
};

export default KnowledgeSearchPage;
