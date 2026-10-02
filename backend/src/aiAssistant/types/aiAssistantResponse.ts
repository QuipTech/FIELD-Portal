export interface AssistantMachine {
  id: string;
  label: string;
}

export interface AssistantConversation {
  id: string;
  title: string;
  machine: AssistantMachine | null;
  updatedAt: string;
}

// One retrieved excerpt behind an answer. `index` is its [n] in the
// answer text; the document opens via GET /documents/:documentId/download.
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
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  // Every excerpt the answer was given (assistant messages only).
  sources: AssistantSource[];
  // The [n] indexes the answer actually cites.
  citedIndexes: number[];
}

export interface AssistantThread {
  conversation: AssistantConversation;
  messages: AssistantMessage[];
}

// Server-sent events from POST /ai/ask, in order: start, delta…, then
// done or error.
export type AskStreamEvent =
  | {
      event: 'start';
      data: { conversationId: string; sources: AssistantSource[] };
    }
  | { event: 'delta'; data: { text: string } }
  | {
      event: 'done';
      data: {
        userMessageId: string;
        assistantMessageId: string;
        citedIndexes: number[];
        stopReason: string | null;
      };
    }
  | { event: 'error'; data: { message: string } };
