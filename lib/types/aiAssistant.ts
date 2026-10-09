// Mirrors backend/src/aiAssistant/types/aiAssistantResponse.ts.

export interface AssistantMachine {
  id: string;
  label: string;
}

export interface AssistantThreadSummary {
  id: string;
  title: string;
  machine: AssistantMachine | null;
  updatedAt: string;
}

// One excerpt behind an answer; `index` is its [n] in the answer text.
export interface AssistantSource {
  index: number;
  chunkId: string;
  // null once the document has been deleted.
  documentId: string | null;
  title: string;
  page: number | null;
  heading: string | null;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources: AssistantSource[];
  citedIndexes: number[];
}

export interface AssistantThread {
  conversation: AssistantThreadSummary;
  messages: AssistantMessage[];
}

// A message on screen: saved, or still streaming in.
export interface ChatEntry extends AssistantMessage {
  isStreaming?: boolean;
  // A photo sent with this question, shown only until the page reloads.
  imagePreviewUrl?: string;
}

export interface AttachedPhoto {
  mediaType: "image/jpeg";
  // Base64, no data: prefix.
  data: string;
  previewUrl: string;
}

export interface AskAssistantInput {
  question: string;
  conversationId?: string;
  machineId?: string;
  // Answer this question from one document only (a Knowledge article's
  // "Ask AI").
  documentId?: string;
  image?: { mediaType: AttachedPhoto["mediaType"]; data: string };
}

export type AskStreamEvent =
  | { event: "start"; data: { conversationId: string; sources: AssistantSource[] } }
  | { event: "delta"; data: { text: string } }
  | {
      event: "done";
      data: { userMessageId: string; assistantMessageId: string; citedIndexes: number[]; stopReason: string | null };
    }
  | { event: "error"; data: { message: string } };
