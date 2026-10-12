import { apiDownloadRequest, apiRequest } from "./httpClient";
import type { ReportType, ScheduledReport, ScheduledReportList, ScheduledReportPayload } from "../types/adminReports";

// Settings → Reports & exports. Owner only; every report covers every
// organisation for the last 30 days.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

const FILE_NAME_PATTERN = /filename="([^"]+)"/;

export const exportReportRequest = async (accessToken: string, reportType: ReportType) => {
  const { blob, headers } = await apiDownloadRequest(`/admin/reports/${reportType}/export`, {
    headers: authorizationHeader(accessToken),
  });
  const fileName = FILE_NAME_PATTERN.exec(headers.get("Content-Disposition") ?? "")?.[1] ?? `${reportType}.csv`;
  return { blob, fileName, isTruncated: headers.get("X-Export-Truncated") === "true" };
};

export const listScheduledReportsRequest = (accessToken: string): Promise<ScheduledReportList> =>
  apiRequest<ScheduledReportList>("/admin/reports/schedules", { headers: authorizationHeader(accessToken) });

export const createScheduledReportRequest = (accessToken: string, payload: ScheduledReportPayload) =>
  apiRequest<ScheduledReport>("/admin/reports/schedules", {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(payload),
  });

export const replaceScheduledReportRequest = (accessToken: string, scheduleId: string, payload: ScheduledReportPayload) =>
  apiRequest<ScheduledReport>(`/admin/reports/schedules/${scheduleId}`, {
    method: "PUT",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(payload),
  });

export const deleteScheduledReportRequest = (accessToken: string, scheduleId: string): Promise<void> =>
  apiRequest<void>(`/admin/reports/schedules/${scheduleId}`, {
    method: "DELETE",
    headers: authorizationHeader(accessToken),
  });

// The report goes out on the server's next check, within a minute.
export const sendScheduledReportNowRequest = (accessToken: string, scheduleId: string) =>
  apiRequest<ScheduledReport>(`/admin/reports/schedules/${scheduleId}/send`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
  });
