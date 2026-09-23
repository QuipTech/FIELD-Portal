import type { ReactNode } from "react";
import { AdminSideNav } from "./adminSideNav";

interface AdminShellProps {
  topBar: ReactNode;
  children: ReactNode;
}

export const AdminShell = ({ topBar, children }: AdminShellProps) => {
  return (
    <div className="flex h-screen flex-col bg-surfaceGray">
      {topBar}
      <div className="flex min-h-0 flex-1">
        <AdminSideNav />
        {children}
      </div>
    </div>
  );
};
