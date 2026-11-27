import type { DesignStatus } from "@/lib/api/machineDesignApi";

// "Send to tablet" (backend migration 0144). The limits are the backend's.
export const MAX_TABLET_FILES = 32;
export const MAX_TABLET_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_TABLET_SEND_BYTES = 20 * 1024 * 1024;

export interface FileTransferSummary {
  status: DesignStatus;
  error: string | null;
  files: { name: string; sizeBytes: number }[];
}

export interface TabletFileSend extends FileTransferSummary {
  id: string;
  sendId: string;
  senderName: string | null;
  createdAt: string;
  updatedAt: string;
}

// Why these files can't be sent together, or null.
export const tabletFilesProblem = (files: { name: string; size: number }[]): string | null => {
  if (files.length > MAX_TABLET_FILES) return `Send up to ${MAX_TABLET_FILES} files at a time.`;
  const large = files.find((file) => file.size > MAX_TABLET_FILE_BYTES);
  if (large) return `${large.name} is over 5 MB.`;
  const empty = files.find((file) => file.size === 0);
  if (empty) return `${empty.name} is empty or is a folder.`;
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TABLET_SEND_BYTES) return "One send can be up to 20 MB in total.";
  return null;
};

// Adds files to the ones already chosen; the same name (Windows ignores case)
// replaces the earlier file.
export const addTabletFiles = <T extends { name: string }>(chosen: T[], added: T[]): T[] => {
  const byName = new Map(chosen.map((file) => [file.name.toLowerCase(), file]));
  added.forEach((file) => byName.set(file.name.toLowerCase(), file));
  return Array.from(byName.values());
};
