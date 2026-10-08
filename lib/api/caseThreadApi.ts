import { apiRequest } from "./httpClient";
import { uploadMultipart } from "./multipartUpload";
import type { CaseAttachment, CaseEvent, CaseMessage, NewCaseMessage } from "../types/caseMessage";

// A case's thread is the same for both sides; only the route differs.
// "customer" is /cases (internal notes never included); "staff" is
// /admin/cases (the admin, or the case's assignee).
export type CaseThreadScope = "customer" | "staff";

const basePath = (scope: CaseThreadScope) => (scope === "staff" ? "/admin/cases" : "/cases");

const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const listCaseMessagesRequest = (accessToken: string, scope: CaseThreadScope, caseNumber: number) =>
  apiRequest<CaseMessage[]>(`${basePath(scope)}/${caseNumber}/messages`, {
    headers: authorizationHeader(accessToken),
  });

export const listCaseEventsRequest = (accessToken: string, scope: CaseThreadScope, caseNumber: number) =>
  apiRequest<CaseEvent[]>(`${basePath(scope)}/${caseNumber}/events`, { headers: authorizationHeader(accessToken) });

// 409 once the case is resolved or closed (staff may still add internal notes
// to a resolved one). Everyone with the case open gets it live.
export const postCaseMessageRequest = (
  accessToken: string,
  scope: CaseThreadScope,
  caseNumber: number,
  message: NewCaseMessage,
) =>
  apiRequest<CaseMessage>(`${basePath(scope)}/${caseNumber}/messages`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(message),
  });

export const markCaseReadRequest = (accessToken: string, scope: CaseThreadScope, caseNumber: number) =>
  apiRequest<null>(`${basePath(scope)}/${caseNumber}/read`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
  });

// A photo or PDF/Word document (≤ 20 MB). Send the returned id in the
// message's attachmentIds. Customers upload before the case exists (the
// New case form), so their uploads aren't tied to a case number.
export const uploadCaseAttachmentRequest = (
  accessToken: string,
  scope: CaseThreadScope,
  caseNumber: number | null,
  file: File,
  onProgress?: (fraction: number) => void,
) =>
  uploadMultipart<CaseAttachment>(
    scope === "staff" ? `/admin/cases/${caseNumber}/attachments` : "/cases/attachments",
    { accessToken, file, onProgress },
  );

export const getUnreadCaseCountRequest = (accessToken: string, scope: CaseThreadScope) =>
  apiRequest<{ count: number }>(`${basePath(scope)}/unread-count`, { headers: authorizationHeader(accessToken) });
