import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/paginationQueryDto';
import { assertMachineInTenant } from '../../machineHistory/machineHistory.service';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { KnowledgeAccessService } from '../access/knowledgeAccess.service';
import { toCatalogDocument, toTotal } from '../catalogDocumentMapper';
import { loadVisibleDocument } from '../documents/catalogDocumentAccess';
import { ForMyMachinesQueryDto } from '../dto/forMyMachinesQueryDto';
import { RecordRecentViewDto } from '../dto/recordRecentViewDto';
import { CatalogDocument, Paged } from '../types/catalogResponse';
import * as myKnowledgeRepository from './myKnowledge.repository';
import { MatchedMachine } from './myKnowledge.repository';

export interface RecentDocument extends CatalogDocument {
  lastViewedPage: number | null;
  viewedAt: string;
}

export interface MachineDocument extends CatalogDocument {
  matchedMachines: MatchedMachine[];
}

@Injectable()
export class MyKnowledgeService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly knowledgeAccess: KnowledgeAccessService,
  ) {}

  // Only documents the caller can still open (a document archived or
  // dropped from the plan since disappears from the list).
  listRecent = async (actor: AuthenticatedUser): Promise<RecentDocument[]> => {
    const access = await this.knowledgeAccess.resolve(actor);
    const rows = await this.databaseService.withTenant(
      actor.tenantId,
      (client) => myKnowledgeRepository.listRecentDocuments(client, access),
    );
    return rows.map((row) => ({
      ...toCatalogDocument(row, access),
      lastViewedPage: row.last_page,
      viewedAt: row.viewed_at.toISOString(),
    }));
  };

  // Same 404/403 as opening the document.
  recordView = async (
    actor: AuthenticatedUser,
    dto: RecordRecentViewDto,
  ): Promise<void> => {
    const access = await this.knowledgeAccess.resolve(actor);
    await this.databaseService.withTenant(actor.tenantId, async (client) => {
      await loadVisibleDocument(client, access, dto.documentId);
      await myKnowledgeRepository.upsertRecentView(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        itemId: dto.documentId,
        page: dto.page ?? null,
      });
    });
  };

  listMachineManuals = async (
    actor: AuthenticatedUser,
    machineId: string,
    query: PaginationQueryDto,
  ): Promise<Paged<MachineDocument>> => {
    await this.databaseService.withTenant(actor.tenantId, (client) =>
      assertMachineInTenant(client, actor.tenantId, machineId),
    );
    return this.listForMyMachines(
      actor,
      Object.assign(new ForMyMachinesQueryDto(), { ...query, machineId }),
    );
  };

  listForMyMachines = async (
    actor: AuthenticatedUser,
    query: ForMyMachinesQueryDto,
  ): Promise<Paged<MachineDocument>> => {
    const access = await this.knowledgeAccess.resolve(actor);
    const rows = await this.databaseService.withTenant(
      actor.tenantId,
      (client) =>
        myKnowledgeRepository.listDocumentsForMachines(client, access, query),
    );
    return {
      items: rows.map((row) => ({
        ...toCatalogDocument(row, access),
        matchedMachines: row.matched_machines,
      })),
      total: toTotal(rows),
      page: query.page,
      pageSize: query.pageSize,
    };
  };
}
