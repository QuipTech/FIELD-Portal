import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { runAuditedChange } from '../../common/audit/runAuditedChange';
import * as aiPromptsRepository from './aiPrompts.repository';
import { diffPromptLines } from './diffPromptLines';
import { CreatePromptVersionDto } from '../dto/createPromptVersionDto';
import { PromptVersionRow } from '../types/adminAiRows';
import {
  PromptDiff,
  PromptVersion,
  PromptVersionSummary,
} from '../types/adminAiResponse';

const VERSION_NOT_FOUND_MESSAGE = 'Prompt version not found.';
const NO_EARLIER_VERSION_MESSAGE =
  'This is the first version, so there is nothing earlier to compare with.';
const SAVE_CONFLICT_MESSAGE =
  'Someone saved the prompt at the same time. Reload and try again.';

const toSummary = (row: PromptVersionRow): PromptVersionSummary => ({
  id: row.id,
  versionNumber: row.version_number,
  isLive: row.is_live,
  notes: row.notes,
  createdAt: row.created_at.toISOString(),
  createdByName: row.created_by_name,
  publishedAt: row.published_at?.toISOString() ?? null,
  publishedByName: row.published_by_name,
});

// The one platform-wide assistant prompt. Versions are never edited:
// saving adds one, and publishing picks which one is live.
@Injectable()
export class AiPromptsService {
  constructor(private readonly databaseService: DatabaseService) {}

  listVersions = async (): Promise<PromptVersionSummary[]> => {
    const rows = await aiPromptsRepository.listPromptVersions(
      this.databaseService,
    );
    return rows.map(toSummary);
  };

  getVersion = async (versionId: string): Promise<PromptVersion> => {
    const row = await this.findVersionRow(versionId);
    return { ...toSummary(row), body: row.body };
  };

  createVersion = async (
    actor: AuthenticatedUser,
    dto: CreatePromptVersionDto,
  ): Promise<PromptVersion> => {
    const versionId = await runAuditedChange(
      this.databaseService,
      actor,
      SAVE_CONFLICT_MESSAGE,
      async (client) => {
        const created = await aiPromptsRepository.insertPromptVersion(client, {
          body: dto.body,
          notes: dto.notes,
          createdBy: actor.userId,
        });
        if (dto.publish) {
          await aiPromptsRepository.publishPromptVersion(client, {
            versionId: created.id,
            publishedBy: actor.userId,
          });
        }
        const metadata = {
          versionNumber: created.versionNumber,
          published: dto.publish,
        };
        const audit = {
          action: 'create',
          entityType: 'ai_prompt_version',
        } as const;
        return {
          result: created.id,
          audit: { ...audit, entityId: created.id, metadata },
        };
      },
    );
    return this.getVersion(versionId);
  };

  // Also how an older version is rolled back to.
  publishVersion = async (
    actor: AuthenticatedUser,
    versionId: string,
  ): Promise<PromptVersion> => {
    const version = await this.getVersion(versionId);
    await runAuditedChange(
      this.databaseService,
      actor,
      SAVE_CONFLICT_MESSAGE,
      async (client) => {
        const isPublished = await aiPromptsRepository.publishPromptVersion(
          client,
          {
            versionId,
            publishedBy: actor.userId,
          },
        );
        if (!isPublished)
          throw new NotFoundException(VERSION_NOT_FOUND_MESSAGE);
        const metadata = {
          versionNumber: version.versionNumber,
          published: true,
        };
        const audit = {
          action: 'update',
          entityType: 'ai_prompt_version',
        } as const;
        return {
          result: versionId,
          audit: { ...audit, entityId: versionId, metadata },
        };
      },
    );
    return this.getVersion(versionId);
  };

  diffVersions = async (
    versionId: string,
    againstId?: string,
  ): Promise<PromptDiff> => {
    const to = await this.findVersionRow(versionId);
    const from = againstId
      ? await this.findVersionRow(againstId)
      : await this.findPreviousVersionRow(to.version_number);
    return {
      from: toSummary(from),
      to: toSummary(to),
      lines: diffPromptLines(from.body, to.body),
    };
  };

  private findVersionRow = async (
    versionId: string,
  ): Promise<PromptVersionRow> => {
    const [row] = await aiPromptsRepository.listPromptVersions(
      this.databaseService,
      versionId,
    );
    if (!row) throw new NotFoundException(VERSION_NOT_FOUND_MESSAGE);
    return row;
  };

  // Versions come back newest first, so the first lower number is the
  // one saved just before.
  private findPreviousVersionRow = async (
    versionNumber: number,
  ): Promise<PromptVersionRow> => {
    const rows = await aiPromptsRepository.listPromptVersions(
      this.databaseService,
    );
    const previous = rows.find((row) => row.version_number < versionNumber);
    if (!previous) throw new NotFoundException(NO_EARLIER_VERSION_MESSAGE);
    return previous;
  };
}
