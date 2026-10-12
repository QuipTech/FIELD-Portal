// Inputs and outputs of BedrockService.generateTechnicalResponse. The
// caller (the AI assistant) does retrieval and persistence; this module
// only talks to Bedrock.

// One excerpt retrieved from pgvector, numbered [n] in the prompt by its
// position in the array (1-based).
export interface RetrievedChunk {
  chunkId: string;
  // knowledge_items.id — what GET /documents/:id/download takes.
  documentId: string;
  title: string;
  page: number | null;
  heading: string | null;
  text: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

// The media types Claude accepts for image blocks.
export const IMAGE_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

export interface AttachedImage {
  mediaType: ImageMediaType;
  // Base64 without the "data:…;base64," prefix.
  data: string;
}

export interface TechnicalQuestion {
  // For logs only: tenant scoping happens in the caller's queries.
  tenantId: string;
  question: string;
  chunks?: RetrievedChunk[];
  image?: AttachedImage;
  history: ConversationTurn[];
  // The published admin prompt; the built-in one when omitted.
  systemPrompt?: string;
  // The machine and its recent service history, as plain text.
  machineContext?: string;
}

export type ModelTier = 'primary' | 'light';

export interface TechnicalResponse {
  modelId: string;
  tier: ModelTier;
  text: string;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
}

export interface TechnicalResponseOptions {
  // Called with each piece of the answer as Bedrock streams it.
  onText: (text: string) => void;
  // Aborts the Bedrock call, e.g. when the technician closes the page.
  signal?: AbortSignal;
}
