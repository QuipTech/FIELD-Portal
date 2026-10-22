import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { KnowledgeAccessService } from '../access/knowledgeAccess.service';
import { toCatalogDocument } from '../catalogDocumentMapper';
import { CatalogDocument } from '../types/catalogResponse';
import {
  ATTENTION_REASONS,
  AttentionReason,
  listAttentionDocuments,
} from './knowledgeAttention.repository';

export interface AttentionItem extends CatalogDocument {
  reason: AttentionReason;
  reviewNote: string | null;
  errorMessage: string | null;
  licenceExpiresAt: string | null;
}

// GET /admin/knowledge/attention
export interface KnowledgeAttention {
  counts: Record<AttentionReason, number>;
  items: AttentionItem[];
}

const emptyCounts = (): Record<AttentionReason, number> =>
  Object.fromEntries(ATTENTION_REASONS.map((reason) => [reason, 0])) as Record<
    AttentionReason,
    number
  >;

@Injectable()
export class KnowledgeAttentionService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly knowledgeAccess: KnowledgeAccessService,
  ) {}

  list = async (actor: AuthenticatedUser): Promise<KnowledgeAttention> => {
    const access = await this.knowledgeAccess.resolve(actor);
    const rows = await this.databaseService.withActor(actor, (client) =>
      listAttentionDocuments(client, access),
    );
    const counts = emptyCounts();
    for (const row of rows) counts[row.reason] += 1;
    return {
      counts,
      items: rows.map((row) => ({
        ...toCatalogDocument(row, access),
        reason: row.reason,
        reviewNote: row.review_note,
        errorMessage: row.error_message,
        licenceExpiresAt: row.licence_expires_at?.toISOString() ?? null,
      })),
    };
  };
}
