import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Input } from "@/components/ui/input";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { supportCases } from "@/lib/mockData/cases";
import { CasesTable } from "./components/casesTable";

const CasesPage = () => {
  const openCount = supportCases.length;

  return (
    <AppShell
      topBar={
        <TopBar
          showUserMenu={false}
          actions={
            <PermissionButton permission={PERMISSIONS.raiseSupportCase} variant="primary">
              <Icon name="plus" />
              New case
            </PermissionButton>
          }
        >
          <span className="text-[15px] text-bodyGray">Support cases</span>
        </TopBar>
      }
    >
      <main className="m-4 flex flex-1 flex-col gap-3.5 overflow-y-auto rounded-2xl border border-slate-200/80 bg-surface p-5">
        <div className="flex items-center gap-2">
          <Tag tone="amber">Open · {openCount} <Icon name="chevd" className="h-3.5 w-3.5" /></Tag>
          <Tag>Priority <Icon name="chevd" className="h-3.5 w-3.5" /></Tag>
          <Tag>Assignee <Icon name="chevd" className="h-3.5 w-3.5" /></Tag>
          <Input icon="search" placeholder="Search cases" className="ml-auto w-52" />
        </div>
        <CasesTable />
      </main>
    </AppShell>
  );
};

export default CasesPage;
