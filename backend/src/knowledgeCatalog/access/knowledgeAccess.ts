// Knowledge admins see documents in every state (needs review, failed,
// archived) and the admin counts; everyone else sees live documents only.
// Which brands and documents anyone may read is decided in SQL by
// knowledge_can_read_document (migrations 0086, 0093).
export const KNOWLEDGE_ADMIN_PERMISSION = 'knowledge.publish';

export interface KnowledgeAccess {
  tenantId: string;
  userId: string;
  isAdmin: boolean;
  // platform.manage: sees the shared library in the attention queue.
  isPlatform: boolean;
}
