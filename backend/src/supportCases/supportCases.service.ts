import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { DashboardConfig } from '../dashboard/dashboardConfig';
import * as casesRepository from './supportCases.repository';
import * as optionsRepository from './caseOptions.repository';
import { requireSupportCase } from './requireSupportCase';
import { postMessageToCase } from './postMessageToCase';
import { recordCaseChange } from './recordCaseChange';
import { CaseAnnouncer } from './caseAnnouncer.service';
import { canReopenCase, resolveReopenedStatus } from './caseAccessPolicy';
import { toStatusCounts, toSupportCase } from './supportCaseMapper';
import { ListSupportCasesQueryDto } from './dto/listSupportCasesQueryDto';
import { CreateSupportCaseDto } from './dto/createSupportCaseDto';
import {
  CaseStatus,
  SupportCase,
  SupportCaseList,
  SupportCaseOptions,
} from './types/supportCaseResponse';

const UNKNOWN_MACHINE_MESSAGE = 'That machine is not in your organisation.';
const REOPEN_REFUSED_MESSAGE =
  'Only a case resolved in the last 7 days can be reopened.';

// The customer side: cases in the caller's own organisation (tenantId
// from the JWT, every query under its RLS). Customers can't assign or
// change status or priority — that's AdminCaseUpdatesService.
@Injectable()
export class SupportCasesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly dashboardConfig: DashboardConfig,
    private readonly caseAnnouncer: CaseAnnouncer,
  ) {}

  listCases = async (
    actor: AuthenticatedUser,
    query: ListSupportCasesQueryDto,
  ): Promise<SupportCaseList> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const rows = await casesRepository.listCases(client, actor.tenantId, {
        ...query,
        status: query.status ?? 'active',
      });
      const counts = await casesRepository.countCasesByStatus(
        client,
        actor.tenantId,
      );
      return {
        items: rows.map(toSupportCase),
        statusCounts: toStatusCounts(counts),
      };
    });

  getCase = async (
    actor: AuthenticatedUser,
    caseNumber: number,
  ): Promise<SupportCase> =>
    this.databaseService.withTenant(actor.tenantId, async (client) =>
      toSupportCase(
        await requireSupportCase(client, actor.tenantId, caseNumber),
      ),
    );

  // Machines for the New case form.
  getOptions = async (actor: AuthenticatedUser): Promise<SupportCaseOptions> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const machines = await optionsRepository.listMachineOptions(
        client,
        actor.tenantId,
      );
      return {
        machines: machines.map((machine) => ({
          id: machine.id,
          label: machine.label,
          modelName: machine.model_name,
        })),
      };
    });

  // One transaction: the case, its "created" line and audit entry, and the
  // description as its first message carrying the attachments.
  createCase = async (
    actor: AuthenticatedUser,
    dto: CreateSupportCaseDto,
  ): Promise<SupportCase> => {
    const posted = await this.databaseService.withActor(
      actor,
      async (client) => {
        if (
          dto.machineId &&
          !(await optionsRepository.machineBelongsToTenant(
            client,
            actor.tenantId,
            dto.machineId,
          ))
        ) {
          throw new BadRequestException(UNKNOWN_MACHINE_MESSAGE);
        }
        const inserted = await casesRepository.insertCase(client, {
          tenantId: actor.tenantId,
          reporterId: actor.userId,
          subject: dto.subject,
          description: dto.description,
          category: dto.category,
          priority: dto.priority,
          machineId: dto.machineId ?? null,
          slaHours: Math.round(this.dashboardConfig.slaHours[dto.priority]),
        });
        const caseNumber = Number(inserted.case_number);
        await recordCaseChange(client, {
          tenantId: actor.tenantId,
          caseId: inserted.id,
          caseNumber,
          actorId: actor.userId,
          action: 'create',
          events: [{ type: 'created', toValue: dto.priority }],
        });
        return postMessageToCase(client, {
          tenantId: actor.tenantId,
          supportCase: await requireSupportCase(
            client,
            actor.tenantId,
            caseNumber,
          ),
          authorId: actor.userId,
          authorRole: 'customer',
          body: dto.description,
          isInternal: false,
          attachmentIds: dto.attachmentIds ?? [],
        });
      },
    );
    const created = toSupportCase(posted.supportCase);
    this.caseAnnouncer.announceChange(actor.tenantId, {
      row: posted.supportCase,
      events: [],
      actorId: actor.userId,
      previousAssigneeId: null,
    });
    return created;
  };

  // Within 7 days of being resolved, anyone in the organisation can
  // reopen a case: back to its assignee (open), or to the queue (new).
  reopenCase = async (
    actor: AuthenticatedUser,
    caseNumber: number,
  ): Promise<SupportCase> => {
    const change = await this.databaseService.withActor(
      actor,
      async (client) => {
        const existing = await requireSupportCase(
          client,
          actor.tenantId,
          caseNumber,
        );
        if (
          !canReopenCase(
            existing.status as CaseStatus,
            existing.resolved_at,
            new Date(),
          )
        ) {
          throw new ConflictException(REOPEN_REFUSED_MESSAGE);
        }
        const status = resolveReopenedStatus(existing.assignee_id);
        await casesRepository.updateCase(client, {
          tenantId: actor.tenantId,
          caseId: existing.id,
          patch: { status },
        });
        const events = await recordCaseChange(client, {
          tenantId: actor.tenantId,
          caseId: existing.id,
          caseNumber,
          actorId: actor.userId,
          action: 'update',
          events: [
            { type: 'reopened', fromValue: existing.status, toValue: status },
          ],
        });
        const row = await requireSupportCase(
          client,
          actor.tenantId,
          caseNumber,
        );
        return { row, events };
      },
    );
    return this.caseAnnouncer.announceChange(actor.tenantId, {
      ...change,
      actorId: actor.userId,
      previousAssigneeId: null,
    });
  };
}
