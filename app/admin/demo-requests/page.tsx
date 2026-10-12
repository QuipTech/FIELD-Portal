import { Suspense } from "react";
import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { PermissionView } from "@/components/auth/permissionView";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { DemoRequestsManager } from "./components/demoRequestsManager";

// Demo requests from the marketing site — platform administrator only.
// Suspense: the manager reads ?id= (the link in the team's email).
const DemoRequestsPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="Demo requests" />}>
      <main className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-5">
        <PermissionView permission={PERMISSIONS.managePlatform}>
          <Suspense>
            <DemoRequestsManager />
          </Suspense>
        </PermissionView>
      </main>
    </AdminShell>
  );
};

export default DemoRequestsPage;
