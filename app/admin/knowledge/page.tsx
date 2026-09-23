import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { DocumentsTable } from "./components/documentsTable";

const AdminKnowledgePage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="Knowledge" showBell={false} />}>
      <main className="m-4 flex flex-1 flex-col gap-3.5 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-6">
        <div className="flex items-center">
          <h1 className="text-[22px] font-medium text-ink">Knowledge</h1>
          <Button variant="primary" className="ml-auto">
            <Icon name="upload" />
            Upload documents
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Tag>All types <Icon name="chevd" className="h-3.5 w-3.5" /></Tag>
          <Tag>Status <Icon name="chevd" className="h-3.5 w-3.5" /></Tag>
          <Tag>Make <Icon name="chevd" className="h-3.5 w-3.5" /></Tag>
          <span className="ml-auto text-xs text-slate-400">1,284 documents</span>
        </div>
        <div className="flex flex-none flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-borderGrayStrong p-5 text-center text-xs text-mutedGray">
          <Icon name="cloud" className="h-6 w-6" />
          Drop PDFs or manuals here — parse &amp; index progress is shown per file
        </div>
        <DocumentsTable />
      </main>
    </AdminShell>
  );
};

export default AdminKnowledgePage;
