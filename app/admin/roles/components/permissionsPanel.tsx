"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { technicianPermissions } from "@/lib/mockData/adminRoles";

export const PermissionsPanel = () => {
  const [permissions, setPermissions] = useState(technicianPermissions);

  const togglePermission = (label: string) => {
    setPermissions((current) =>
      current.map((permission) =>
        permission.label === label ? { ...permission, on: !permission.on } : permission,
      ),
    );
  };

  return (
    <div className="flex flex-[1.7] flex-col rounded-xl border border-borderGray bg-white p-4">
      <div className="flex items-baseline pb-2.5">
        <h2 className="text-base font-medium text-ink">Permissions — Technician</h2>
        <span className="ml-auto text-xs text-mutedGray">Changes are audited</span>
      </div>
      <div className="flex flex-col divide-y divide-slate-100">
        {permissions.map((permission) => (
          <div key={permission.label} className="flex items-center py-2.5">
            <span className="text-[15px] text-ink">{permission.label}</span>
            <span className="ml-auto">
              <Switch on={permission.on} onToggle={() => togglePermission(permission.label)} />
            </span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center border-t border-slate-100 pt-3.5">
        <Button variant="ghost">Discard</Button>
        <Button variant="primary" className="ml-auto">Save changes</Button>
      </div>
    </div>
  );
};
