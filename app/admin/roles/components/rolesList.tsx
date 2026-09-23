"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { adminRoles } from "@/lib/mockData/adminRoles";

export const RolesList = () => {
  const [selectedRoleId, setSelectedRoleId] = useState(adminRoles[0]?.id);

  return (
    <div className="flex w-72 max-w-xs flex-none flex-col gap-2.5">
      {adminRoles.map((role) => {
        const selected = role.id === selectedRoleId;
        return (
          <button
            key={role.id}
            onClick={() => setSelectedRoleId(role.id)}
            className={`flex flex-col gap-1.5 rounded-2xl border p-4 text-left ${
              selected ? "border-primaryBorder bg-primaryTint" : "border-borderGray bg-white"
            }`}
          >
            <div className="flex items-center">
              <span className={`text-[15px] ${selected ? "font-medium text-ink" : "text-ink"}`}>{role.name}</span>
              <Icon name="chevr" className={`ml-auto ${selected ? "stroke-primary" : "stroke-mutedGray"}`} />
            </div>
            <span className="text-xs text-mutedGray">{role.summary}</span>
          </button>
        );
      })}
    </div>
  );
};
