import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { NewCaseButton } from "./components/newCaseButton";
import { CasesManager } from "./components/casesManager";

const CasesPage = () => {
  return (
    <AppShell
      topBar={
        <TopBar showUserMenu={false} actions={<NewCaseButton />}>
          <span className="text-[15px] text-bodyGray">Support cases</span>
        </TopBar>
      }
    >
      <main className="m-4 flex flex-1 flex-col gap-3.5 overflow-y-auto rounded-2xl border border-slate-200/80 bg-surface p-5">
        <CasesManager />
      </main>
    </AppShell>
  );
};

export default CasesPage;
