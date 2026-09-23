export interface AdminRole {
  id: string;
  name: string;
  summary: string;
}

export const adminRoles: AdminRole[] = [
  { id: "technician", name: "Technician", summary: "42 users · 4 of 8 permissions" },
  { id: "supervisor", name: "Supervisor", summary: "8 users · 6 of 8 permissions" },
  { id: "admin", name: "Admin", summary: "3 users · all permissions" },
];

export const technicianPermissions: { label: string; on: boolean }[] = [
  { label: "View machines", on: true },
  { label: "Add history entries", on: true },
  { label: "Edit others’ entries", on: false },
  { label: "Use AI assistant", on: true },
  { label: "Raise support cases", on: true },
  { label: "Publish knowledge", on: false },
  { label: "Manage machine library", on: false },
  { label: "Manage users", on: false },
  { label: "View audit log", on: false },
];
