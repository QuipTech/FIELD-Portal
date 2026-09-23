import type { ReactNode } from "react";
import { SideNav } from "./sideNav";

interface AppShellProps {
  topBar: ReactNode;
  children: ReactNode;
}

export const AppShell = ({ topBar, children }: AppShellProps) => {
  return (
    <div className="flex h-screen flex-col bg-surfaceGray">
      {topBar}
      <div className="flex min-h-0 flex-1">
        <SideNav />
        {children}
      </div>
    </div>
  );
};
