import type { ReactNode } from "react";
import { Tag } from "../ui/tag";
import { TopBar } from "./topBar";

const adminUserMenuItems = [
  { icon: "grid" as const, label: "Switch to portal view", href: "/dashboard" },
  { icon: "settings" as const, label: "Settings", href: "/admin/settings" },
];

interface AdminTopBarProps {
  label: string;
  actions?: ReactNode;
}

export const AdminTopBar = ({ label, actions }: AdminTopBarProps) => {
  return (
    <TopBar
      logoHref="/admin/dashboard"
      userMenuItems={adminUserMenuItems}
      actions={actions}
    >
      <Tag tone="primary">Admin view</Tag>
      <span className="text-[15px] text-bodyGray">{label}</span>
    </TopBar>
  );
};
