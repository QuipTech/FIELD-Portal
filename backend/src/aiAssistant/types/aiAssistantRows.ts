export interface ConversationRow {
  id: string;
  title: string | null;
  machine_id: string | null;
  machine_label: string | null;
  updated_at: Date;
}

export interface MessageRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: Date;
}

export interface MessageSourceRow {
  message_id: string;
  chunk_id: string;
  document_id: string | null;
  title: string | null;
  page_number: number | null;
  section_heading: string | null;
}

export interface LivePromptRow {
  version_number: number;
  body: string;
}
