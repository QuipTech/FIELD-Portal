import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { AuditLogTable } from "./components/auditLogTable";

const AuditLogPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="Audit log" showBell={false} />}>
      <main className="m-4 flex flex-1 flex-col gap-3.5 overflow-y-auto rounded-2xl border border-slate-200/80 bg-surface p-6">
        <div className="flex items-center">
          <h1 className="text-[22px] font-medium text-ink">Audit log</h1>
          <Button className="ml-auto">
            <Icon name="download" />
            Export CSV
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Tag>Actor <Icon name="chevd" className="h-3.5 w-3.5" /></Tag>
          <Tag>Action <Icon name="chevd" className="h-3.5 w-3.5" /></Tag>
          <Tag>Last 7 days <Icon name="chevd" className="h-3.5 w-3.5" /></Tag>
          <span className="ml-auto text-xs text-slate-400">2,914 events</span>
        </div>
        <AuditLogTable />
      </main>
    </AdminShell>
  );
};

export default AuditLogPage;
