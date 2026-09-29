import { labelEventType } from './auditEventLabels';

type Metadata = Record<string, unknown>;

export interface AuditEventInput {
  entity_type: string;
  action: string;
  metadata: Metadata;
  target_name: string | null;
}

export interface AuditEventDescription {
  actionLabel: string;
  target: string;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;
const record = (value: unknown): Metadata =>
  value && typeof value === 'object' ? (value as Metadata) : {};
const list = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
const joinParts = (...parts: (string | undefined)[]) =>
  parts.filter(Boolean).join(' · ') || '—';

const DOCUMENT_TRANSITION_LABELS: Record<string, string> = {
  approve: 'Approved document',
  reject: 'Rejected document',
  archive: 'Archived document',
  retry: 'Retried indexing',
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  in_review: 'Started review',
  resolved: 'Resolved flagged answer',
  escalated: 'Escalated flagged answer',
  unreviewed: 'Returned to review queue',
};

// "Supervisor · +knowledge.publish, −audit.view"
const describePermissionChange = (before: string[], after: string[]) => {
  const added = after
    .filter((code) => !before.includes(code))
    .map((code) => `+${code}`);
  const removed = before
    .filter((code) => !after.includes(code))
    .map((code) => `−${code}`);
  return [...added, ...removed].join(', ') || 'no change';
};

const describeRoleUpdate = (metadata: Metadata, name: string | undefined) => {
  const before = record(metadata.before);
  const after = record(metadata.after);
  const newName = text(after.name);
  if (newName && newName !== text(before.name)) {
    return {
      actionLabel: 'Renamed role',
      target: `${text(before.name) ?? '—'} → ${newName}`,
    };
  }
  return {
    actionLabel: 'Changed role permissions',
    target: joinParts(
      name ?? text(before.name),
      describePermissionChange(
        list(before.permissionCodes),
        list(after.permissionCodes),
      ),
    ),
  };
};

const describeDocumentUpdate = (
  metadata: Metadata,
  title: string | undefined,
) => {
  const transition = text(metadata.transition);
  if (transition) {
    return {
      actionLabel: DOCUMENT_TRANSITION_LABELS[transition] ?? 'Updated document',
      target: joinParts(title, text(metadata.note)),
    };
  }
  if (metadata.newVersion !== undefined) {
    return {
      actionLabel: 'Uploaded new version',
      target: joinParts(title, `v${String(metadata.newVersion)}`),
    };
  }
  // Written by the indexing worker as a document moves through indexing.
  return {
    actionLabel: 'Indexing status changed',
    target: joinParts(
      title,
      `${text(metadata.from) ?? '?'} → ${text(metadata.to) ?? '?'}`,
    ),
  };
};

// Turns one audit row into the "Action" and "Target" columns people read.
// target_name is the entity's current name; the metadata snapshot covers
// entities that have since been deleted.
export const describeAuditEvent = (
  event: AuditEventInput,
): AuditEventDescription => {
  const {
    entity_type: entityType,
    action,
    metadata,
    target_name: currentName,
  } = event;
  const actionLabel = labelEventType(entityType, action);
  const name =
    currentName ??
    text(metadata.name) ??
    text(metadata.title) ??
    text(metadata.displayName);

  switch (entityType) {
    case 'role':
      return action === 'update'
        ? describeRoleUpdate(metadata, name)
        : { actionLabel, target: joinParts(name) };
    case 'knowledge_item':
      return action === 'update'
        ? describeDocumentUpdate(metadata, name ?? text(metadata.fileName))
        : { actionLabel, target: joinParts(name ?? text(metadata.fileName)) };
    case 'technical_history_entry':
      return {
        actionLabel,
        target: joinParts(currentName ?? undefined, text(metadata.entryType)),
      };
    case 'machine_model':
      if (metadata.import) {
        return {
          actionLabel: 'Imported system tree',
          target: joinParts(
            name,
            `${String(metadata.systemCount ?? 0)} systems`,
          ),
        };
      }
      return {
        actionLabel,
        target: joinParts(
          name ??
            [text(metadata.manufacturerName), text(metadata.name)]
              .filter(Boolean)
              .join(' '),
        ),
      };
    case 'ai_prompt_version': {
      const version =
        currentName ??
        (metadata.versionNumber ? `v${String(metadata.versionNumber)}` : '');
      const isPublished = action === 'update' || metadata.published === true;
      return {
        actionLabel:
          `${isPublished ? 'Published' : 'Saved'} prompt ${version}`.trim(),
        target: 'AI configuration',
      };
    }
    case 'ai_review_item': {
      const status = text(record(metadata.after).status);
      const statusChanged =
        status && status !== text(record(metadata.before).status);
      return {
        actionLabel: statusChanged
          ? (REVIEW_STATUS_LABELS[status] ?? actionLabel)
          : 'Updated review notes',
        target: 'Review queue',
      };
    }
    case 'organisation_branding': {
      const logo = text(metadata.logo);
      const label =
        logo === 'uploaded'
          ? 'Uploaded logo'
          : logo === 'removed'
            ? 'Removed logo'
            : actionLabel;
      return { actionLabel: label, target: joinParts(name) };
    }
    default:
      return { actionLabel, target: joinParts(name) };
  }
};
