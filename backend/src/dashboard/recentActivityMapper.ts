import { findCitedIndexes } from '../aiAssistant/findCitedIndexes';
import { ActivityItem, ActivityTone } from './types/dashboardResponse';
import {
  CaseActivityRow,
  EntryActivityRow,
  KnowledgeActivityRow,
  ThreadActivityRow,
} from './types/dashboardRows';

const EXCERPT_LENGTH = 60;

const CASE_STATUS_LABELS: Record<string, string> = {
  open: 'open',
  in_progress: 'in progress',
  resolved: 'resolved',
};
const PRIORITY_TONES: Record<string, ActivityTone> = {
  P1: 'danger',
  P2: 'amber',
  P3: 'primary',
};
const ENTRY_TYPE_LABELS: Record<string, string> = {
  service: 'Service',
  repair: 'Repair',
  inspection: 'Inspection',
  fault: 'Fault',
  note: 'Note',
};
const KNOWLEDGE_TYPE_LABELS: Record<string, string> = {
  document: 'Document',
  known_issue: 'Known issue',
  troubleshooting_guide: 'Troubleshooting guide',
  bulletin: 'Bulletin',
  resolution: 'Resolution',
};

const joinCaption = (...parts: (string | null | undefined)[]) =>
  parts.filter(Boolean).join(' · ');

const excerpt = (text: string) => {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  return singleLine.length > EXCERPT_LENGTH
    ? `${singleLine.slice(0, EXCERPT_LENGTH)}…`
    : singleLine;
};

export const caseToActivity = (row: CaseActivityRow): ActivityItem => {
  const status = CASE_STATUS_LABELS[row.status] ?? row.status;
  return {
    id: `case-${row.case_number}`,
    kind: 'case',
    title: `Case #${row.case_number} · ${row.subject}`,
    caption: joinCaption(row.machine_label, status),
    occurredAt: new Date(row.updated_at).toISOString(),
    href: `/cases/${row.case_number}`,
    tag:
      row.status === 'resolved'
        ? { label: 'Resolved', tone: 'ok' }
        : {
            label: `${row.priority} ${status}`,
            tone: PRIORITY_TONES[row.priority] ?? 'default',
          },
  };
};

export const entryToActivity = (row: EntryActivityRow): ActivityItem => {
  const author = [row.author_first_name, row.author_last_name]
    .filter(Boolean)
    .join(' ');
  return {
    id: `entry-${row.id}`,
    kind: 'history_entry',
    title: `${ENTRY_TYPE_LABELS[row.entry_type] ?? 'Entry'} logged on ${row.machine_label}`,
    caption: joinCaption(author, excerpt(row.description)),
    occurredAt: new Date(row.created_at).toISOString(),
    href: `/machines/${row.machine_id}/history`,
    tag: null,
  };
};

export const threadToActivity = (row: ThreadActivityRow): ActivityItem => {
  const cited = row.latest_answer
    ? findCitedIndexes(row.latest_answer, Number(row.source_count)).length
    : 0;
  return {
    id: `thread-${row.id}`,
    kind: 'ai_thread',
    title: `AI thread — ${row.title ?? 'New thread'}`,
    caption: joinCaption(
      row.machine_label,
      cited === 1 ? '1 source cited' : `${cited} sources cited`,
    ),
    occurredAt: new Date(row.updated_at).toISOString(),
    href: `/assistant?thread=${row.id}`,
    tag: null,
  };
};

export const knowledgeToActivity = (
  row: KnowledgeActivityRow,
): ActivityItem => ({
  id: `knowledge-${row.id}`,
  kind: 'knowledge',
  title: `${row.title} added to Knowledge`,
  caption: joinCaption(
    KNOWLEDGE_TYPE_LABELS[row.type] ?? 'Document',
    row.is_shared ? 'Shared library' : null,
  ),
  occurredAt: new Date(row.created_at).toISOString(),
  href: '/knowledge',
  tag: null,
});

// Newest first across every source.
export const mergeActivity = (
  items: ActivityItem[],
  limit: number,
): ActivityItem[] =>
  [...items]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
