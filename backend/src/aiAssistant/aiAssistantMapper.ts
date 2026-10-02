import { RetrievedChunk } from '../bedrock/types/technicalResponse';
import { findCitedIndexes } from './findCitedIndexes';
import {
  AssistantConversation,
  AssistantMessage,
  AssistantSource,
} from './types/aiAssistantResponse';
import {
  ConversationRow,
  MessageRow,
  MessageSourceRow,
} from './types/aiAssistantRows';

const UNTITLED_THREAD = 'New thread';
const DELETED_DOCUMENT_TITLE = 'Removed document';
const TITLE_MAX_LENGTH = 80;

// The first question, shortened on a word boundary.
export const toThreadTitle = (question: string): string => {
  const singleLine = question.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= TITLE_MAX_LENGTH) return singleLine;
  const cut = singleLine.slice(0, TITLE_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > TITLE_MAX_LENGTH / 2 ? cut.slice(0, lastSpace) : cut}…`;
};

export const toAssistantConversation = (
  row: ConversationRow,
): AssistantConversation => ({
  id: row.id,
  title: row.title || UNTITLED_THREAD,
  machine:
    row.machine_id && row.machine_label
      ? { id: row.machine_id, label: row.machine_label }
      : null,
  updatedAt: new Date(row.updated_at).toISOString(),
});

export const chunksToSources = (chunks: RetrievedChunk[]): AssistantSource[] =>
  chunks.map((chunk, position) => ({
    index: position + 1,
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    title: chunk.title,
    page: chunk.page,
    heading: chunk.heading,
  }));

const rowsToSources = (rows: MessageSourceRow[]): AssistantSource[] =>
  rows.map((row, position) => ({
    index: position + 1,
    chunkId: row.chunk_id,
    documentId: row.document_id,
    title: row.title ?? DELETED_DOCUMENT_TITLE,
    page: row.page_number,
    heading: row.section_heading,
  }));

export const toAssistantMessages = (
  messages: MessageRow[],
  sourceRows: MessageSourceRow[],
): AssistantMessage[] =>
  messages.map((message) => {
    const sources = rowsToSources(
      sourceRows.filter((row) => row.message_id === message.id),
    );
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: new Date(message.created_at).toISOString(),
      sources,
      citedIndexes:
        message.role === 'assistant'
          ? findCitedIndexes(message.content, sources.length)
          : [],
    };
  });
