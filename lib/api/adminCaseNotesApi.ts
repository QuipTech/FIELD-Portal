import { apiRequest } from "./httpClient";
import type { CaseMessage } from "../types/caseMessage";

// Internal notes on a case: only their author or the support admin may
// change them.
const notePath = (caseNumber: number, noteId: string) => `/admin/cases/${caseNumber}/notes/${noteId}`;

const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const updateCaseNoteRequest = (accessToken: string, caseNumber: number, noteId: string, body: string) =>
  apiRequest<CaseMessage>(notePath(caseNumber, noteId), {
    method: "PATCH",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify({ body }),
  });

export const deleteCaseNoteRequest = (accessToken: string, caseNumber: number, noteId: string) =>
  apiRequest<void>(notePath(caseNumber, noteId), {
    method: "DELETE",
    headers: authorizationHeader(accessToken),
  });
