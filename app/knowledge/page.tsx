import { TopBar } from "@/components/shell/topBar";
import { knowledgeSearchResults } from "@/lib/mockData/knowledge";
import { KnowledgeFilterNav } from "./components/knowledgeFilterNav";
import { KnowledgeFilterPills } from "./components/knowledgeFilterPills";
import { KnowledgeResultCard } from "./components/knowledgeResultCard";
import { KnowledgeSearchBar } from "./components/knowledgeSearchBar";
import { OrganisationDocuments } from "./components/organisationDocuments";

const KnowledgeSearchPage = () => {
  return (
    <div className="flex h-screen flex-col bg-surfaceGray">
      <TopBar>
        <span className="text-[15px] text-bodyGray">Knowledge</span>
      </TopBar>
      <div className="flex min-h-0 flex-1">
        <div className="m-4 flex flex-1 gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-surface p-3">
          <KnowledgeFilterNav />
          <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-2">
            <KnowledgeSearchBar defaultValue="rear suspension cylinder recharge" />
            <KnowledgeFilterPills />
            <OrganisationDocuments />
            {knowledgeSearchResults.map((result) => (
              <KnowledgeResultCard key={result.slug} result={result} />
            ))}
          </main>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeSearchPage;
