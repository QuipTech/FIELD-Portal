import type { TabletFileSend } from "../types/tabletFiles";
import { apiRequest } from "./httpClient";
import { requireAccessToken } from "./requireAccessToken";

const path = (machineId: string) => `/machines/${machineId}/tablet-files`;
const authorization = () => ({ Authorization: `Bearer ${requireAccessToken()}` });

export const listTabletFileSendsRequest = (machineId: string): Promise<{ sends: TabletFileSend[] }> =>
  apiRequest<{ sends: TabletFileSend[] }>(path(machineId), { headers: authorization(), cache: "no-store" });

// Retrying with the same sendId returns the first send instead of another.
export const sendTabletFilesRequest = (machineId: string, sendId: string, files: File[]): Promise<TabletFileSend> => {
  const body = new FormData();
  body.append("sendId", sendId);
  body.append("names", JSON.stringify(files.map((file) => file.name)));
  files.forEach((file) => body.append("files", file));
  return apiRequest<TabletFileSend>(path(machineId), { method: "POST", headers: authorization(), body });
};
