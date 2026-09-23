import { notFound } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { findCase } from "@/lib/mockData/cases";
import { caseMessagesById } from "@/lib/mockData/caseMessages";
import { getCasePriorityTone } from "@/lib/format/casePriority";
import { CaseMessageThread } from "./components/caseMessageThread";
import { CaseDetailsRail } from "./components/caseDetailsRail";

interface CaseDetailPageProps {
  params: { caseId: string };
}

const CaseDetailPage = ({ params }: CaseDetailPageProps) => {
  const item = findCase(params.caseId);
  if (!item) {
    notFound();
  }

  const messages = caseMessagesById[item.id] ?? [];

  return (
    <div className="flex h-screen flex-col bg-surfaceGray">
      <div className="flex flex-none items-center gap-2.5 border-b border-slate-200/80 bg-white px-6 py-4">
        <Link href="/cases" className="text-[15px] text-bodyGray">Cases</Link>
        <Icon name="chevr" className="stroke-mutedGray" />
        <span className="text-[15px] font-medium text-ink">#{item.id} {item.subject}</span>
        <Tag tone={getCasePriorityTone(item.priority)} className="ml-auto">
          Open · {item.priority}
        </Tag>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="m-4 flex flex-1 gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3">
          <main className="flex flex-[2.2] flex-col gap-3.5 overflow-y-auto p-3">
            <CaseMessageThread messages={messages} />
            <textarea
              rows={3}
              placeholder="Write a reply…"
              className="mt-auto resize-none rounded-lg border border-borderGrayStrong bg-white p-3 text-[15px] text-ink outline-none placeholder:text-mutedGray"
            />
            <div className="flex items-center">
              <Button variant="primary">
                <Icon name="send" />
                Send reply
              </Button>
              <Button className="ml-auto">Resolve case</Button>
            </div>
          </main>
          <CaseDetailsRail item={item} />
        </div>
      </div>
    </div>
  );
};

export default CaseDetailPage;
