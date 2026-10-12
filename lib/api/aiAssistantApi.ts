import { API_BASE_URL, ApiError, CLIENT_HEADERS, apiRequest, extractErrorMessage } from "./httpClient";
import { readEventStream } from "./readEventStream";
import type {
  AskAssistantInput,
  AskStreamEvent,
  AssistantThread,
  AssistantThreadSummary,
} from "../types/aiAssistant";

const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

// The signed-in technician's own threads, newest first.
export const listAssistantThreadsRequest = (accessToken: string) =>
  apiRequest<AssistantThreadSummary[]>("/ai/conversations", { headers: authorizationHeader(accessToken) });

export const getAssistantThreadRequest = (accessToken: string, conversationId: string) =>
  apiRequest<AssistantThread>(`/ai/conversations/${conversationId}`, { headers: authorizationHeader(accessToken) });

// Streams an answer: onEvent gets start, delta…, then done or error.
// Problems before the stream opens (validation, unknown thread, AI not
// set up) throw an ApiError like any other request.
export const askAssistantRequest = async (
  accessToken: string,
  input: AskAssistantInput,
  options: { onEvent: (event: AskStreamEvent) => void; signal?: AbortSignal },
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/ai/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...CLIENT_HEADERS,
      ...authorizationHeader(accessToken),
    },
    body: JSON.stringify(input),
    signal: options.signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(extractErrorMessage(body), response.status);
  }
  await readEventStream(response, (event) => options.onEvent(event as AskStreamEvent));
};
