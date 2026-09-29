import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { runAuditedChange } from '../../common/audit/runAuditedChange';
import * as aiReviewQueueRepository from './aiReviewQueue.repository';
import { resolveReviewAssignment, toReviewQueueItem } from './reviewQueueRules';
import { ListReviewQueueQueryDto } from '../dto/listReviewQueueQueryDto';
import { UpdateReviewItemDto } from '../dto/updateReviewItemDto';
import { ReviewQueueItem, ReviewQueuePage } from '../types/adminAiResponse';

const ITEM_NOT_FOUND_MESSAGE = 'Review item not found.';

// Conversations flagged for admin review, across every organisation.
@Injectable()
export class AiReviewQueueService {
  constructor(private readonly databaseService: DatabaseService) {}

  listItems = async (
    query: ListReviewQueueQueryDto,
  ): Promise<ReviewQueuePage> => {
    const [rows, statusRows] = await Promise.all([
      aiReviewQueueRepository.listReviewItems(this.databaseService, {
        status: query.status,
        reviewerId: query.reviewerId,
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      }),
      aiReviewQueueRepository.countReviewStatuses(this.databaseService),
    ]);
    return {
      items: rows.map(toReviewQueueItem),
      total: Number(rows[0]?.total_count ?? 0),
      page: query.page,
      pageSize: query.pageSize,
      statusCounts: Object.fromEntries(
        statusRows.map((row) => [row.status, Number(row.item_count)]),
      ),
    };
  };

  listReviewers = async () => {
    const rows = await aiReviewQueueRepository.listReviewers(
      this.databaseService,
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      avatarUrl: row.avatar_url,
    }));
  };

  getItem = async (itemId: string): Promise<ReviewQueueItem> => {
    const [row] = await aiReviewQueueRepository.listReviewItems(
      this.databaseService,
      {
        itemId,
        limit: 1,
        offset: 0,
      },
    );
    if (!row) throw new NotFoundException(ITEM_NOT_FOUND_MESSAGE);
    return toReviewQueueItem(row);
  };

  updateItem = async (
    actor: AuthenticatedUser,
    itemId: string,
    dto: UpdateReviewItemDto,
  ): Promise<ReviewQueueItem> => {
    const before = await this.getItem(itemId);
    const next = resolveReviewAssignment(
      { status: before.status, reviewerId: before.reviewer?.id ?? null },
      dto.status,
      actor.userId,
    );
    await runAuditedChange(
      this.databaseService,
      actor,
      ITEM_NOT_FOUND_MESSAGE,
      async (client) => {
        const isUpdated = await aiReviewQueueRepository.updateReviewItem(
          client,
          {
            itemId,
            ...next,
            notes: dto.notes,
          },
        );
        if (!isUpdated) throw new NotFoundException(ITEM_NOT_FOUND_MESSAGE);
        const metadata = {
          before: {
            status: before.status,
            reviewerId: before.reviewer?.id ?? null,
          },
          after: next,
          notesChanged: dto.notes !== undefined,
        };
        const audit = {
          action: 'update',
          entityType: 'ai_review_item',
        } as const;
        return {
          result: itemId,
          audit: { ...audit, entityId: itemId, metadata },
        };
      },
    );
    return this.getItem(itemId);
  };
}
