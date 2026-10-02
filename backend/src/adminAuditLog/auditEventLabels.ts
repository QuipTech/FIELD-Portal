// What each entity_type + action pair is called on the Audit log page.
// Keys match what the backend writes (see insertAuditLog callers).
const EVENT_TYPE_LABELS: Record<string, string> = {
  'user:login': 'Signed in',
  'user:create': 'Signed up',
  'user:update': 'Updated user',
  'user:delete': 'Deleted account',
  'role:create': 'Created role',
  'role:update': 'Changed role',
  'role:delete': 'Deleted role',
  'knowledge_item:create': 'Uploaded document',
  'knowledge_item:update': 'Updated document',
  'knowledge_item:delete': 'Deleted document',
  'technical_history_entry:create': 'Added history entry',
  'machine:create': 'Registered machine',
  'machine:update': 'Changed machine status',
  'machine_photo:create': 'Added machine photo',
  'machine_photo:delete': 'Removed machine photo',
  'machine_model:create': 'Added machine model',
  'machine_model:update': 'Updated machine model',
  'machine_model:delete': 'Deleted machine model',
  'model_system:create': 'Added system',
  'model_system:update': 'Renamed system',
  'model_system:delete': 'Removed system',
  'model_component:create': 'Added component',
  'model_component:update': 'Renamed component',
  'model_component:delete': 'Removed component',
  'ai_prompt_version:create': 'Saved prompt',
  'ai_prompt_version:update': 'Published prompt',
  'ai_review_item:update': 'Updated flagged answer',
  'tenant_subscription:create': 'Set up subscription',
  'tenant_subscription:update': 'Changed subscription',
  'organisation_branding:update': 'Updated branding',
  'alert_rule:create': 'Created alert rule',
  'alert_rule:update': 'Changed alert rule',
  'alert_rule:delete': 'Deleted alert rule',
  'notification_channels:update': 'Changed delivery channels',
  'data_retention:update': 'Changed data retention',
  'scheduled_report:create': 'Created scheduled report',
  'scheduled_report:update': 'Changed scheduled report',
  'scheduled_report:delete': 'Deleted scheduled report',
  'ai_query_logs:delete': 'Purged expired AI query logs',
  'data_export_request:create': 'Requested data export',
  'account_deletion_request:create': 'Requested account deletion',
};

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

// An unmapped pair still reads sensibly: ("update", "fleet_group") →
// "Updated fleet group".
const fallbackLabel = (entityType: string, action: string): string => {
  const verb =
    action === 'login'
      ? 'Signed in to'
      : `${capitalize(action).replace(/e$/, '')}ed`;
  return `${verb} ${entityType.replace(/_/g, ' ')}`;
};

export const labelEventType = (entityType: string, action: string): string =>
  EVENT_TYPE_LABELS[`${entityType}:${action}`] ??
  fallbackLabel(entityType, action);
