import { apiRequest } from "./httpClient";
import type { DashboardSummary } from "../types/dashboard";

// Every figure on the Dashboard screen, for the signed-in user's organisation.
export const getDashboardRequest = (accessToken: string) =>
  apiRequest<DashboardSummary>("/dashboard", { headers: { Authorization: `Bearer ${accessToken}` } });
