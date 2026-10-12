import { apiRequest } from "./httpClient";
import type { AdminOverview } from "../types/adminOverview";

// The admin Overview page: every organisation for the Owner (platform
// administrator), or one organisation when narrowed.
export const getAdminOverviewRequest = (accessToken: string) =>
  apiRequest<AdminOverview>("/admin/overview", { headers: { Authorization: `Bearer ${accessToken}` } });
