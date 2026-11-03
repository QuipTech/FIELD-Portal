import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { DashboardConfig } from '../dashboard/dashboardConfig';
import * as casesRepository from './supportCases.repository';
import * as optionsRepository from './caseOptions.repository';
import { requireVisibleSupportCase } from './requireSupportCase';
import { ACCESSIBLE_MACHINES } from '../machineSharing/access/machineScope';
import { requireMachineAccess } from '../machineSharing/access/machineAccess';
import { postMessageToCase } from './postMessageToCase';
import { recordCaseChange } from './recordCaseChange';
import { CaseAnnouncer } from './caseAnnouncer.service';
import { reopenSupportCase } from './reopenSupportCase';
import { toStatusCounts, toSupportCase } from './supportCaseMapper';
import { ListSupportCasesQueryDto } from './dto/listSupportCasesQueryDto';
import { CreateSupportCaseDto } from './dto/createSupportCaseDto';
import {
  SupportCase,
  SupportCaseList,
  SupportCaseOptions,
} from './types/supportCaseResponse';
import { toCaseCategoryFields } from './toCaseCategoryFields';

const UNKNOWN_MACHINE_MESSAGE =
  "That machine isn't one of yours or shared with you.";

// The customer side: cases in the caller's own organisation (tenantId
// from the JWT, every query under its RLS) that they may see under their
// machine scope (machineSharing/access). Customers can't assign or
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
    this.databaseService.withActor(actor, async (client) => {
      const filters = { ...query, status: query.status ?? 'active' };
      const scope = ACCESSIBLE_MACHINES;
      const tenantId = actor.tenantId;
      const rows = await casesRepository.listCases(
        client,
        tenantId,
        filters,
        scope,
      );
      const total = await casesRepository.countCases(
        client,
        tenantId,
        filters,
        scope,
      );
      const counts = await casesRepository.countCasesByStatus(
        client,
        tenantId,
        scope,
      );
      return {
        items: rows.map(toSupportCase),
        total,
        page: query.page,
        pageSize: query.pageSize,
        statusCounts: toStatusCounts(counts),
      };
    });

  getCase = async (
    actor: AuthenticatedUser,
    caseNumber: number,
  ): Promise<SupportCase> =>
    this.databaseService.withActor(actor, async (client) =>
      toSupportCase(await requireVisibleSupportCase(client, actor, caseNumber)),
    );

  // Machines for the New case form.
  getOptions = async (actor: AuthenticatedUser): Promise<SupportCaseOptions> =>
    this.databaseService.withActor(actor, async (client) => {
      const machines = await optionsRepository.listMachineOptions(client);
      return {
        machines: machines.map((machine) => ({
          id: machine.id,
          label: machine.label,
          modelName: machine.model_name,
          sharedByOrganisationName: machine.shared_by_organisation_name,
        })),
      };
    });

  // One transaction: the case, its "created" line and audit entry, and the
  // description as its first message carrying the attachments. A case
  // about a machine shared with the caller ('contribute') belongs to the
  // machine's owning organisation; the caller is its reporter, audited in
  // their own organisation.
  createCase = async (
    actor: AuthenticatedUser,
    dto: CreateSupportCaseDto,
  ): Promise<SupportCase> => {
    const posted = await this.databaseService.withActor(
      actor,
      async (client) => {
        const caseTenantId = dto.machineId
          ? await this.requireCaseMachineOwner(client, dto.machineId)
          : actor.tenantId;
        const auditTenantId =
          caseTenantId === actor.tenantId ? undefined : actor.tenantId;
        const inserted = await casesRepository.insertCase(client, {
          tenantId: caseTenantId,
          reporterId: actor.userId,
          subject: dto.subject,
          description: dto.description,
          ...toCaseCategoryFields(dto),
          priority: dto.priority,
          machineId: dto.machineId ?? null,
          slaHours: Math.round(this.dashboardConfig.slaHours[dto.priority]),
        });
        const caseNumber = Number(inserted.case_number);
        await recordCaseChange(client, {
          tenantId: caseTenantId,
          auditTenantId,
          caseId: inserted.id,
          caseNumber,
          actorId: actor.userId,
          action: 'create',
          events: [{ type: 'created', toValue: dto.priority }],
        });
        return postMessageToCase(client, {
          tenantId: caseTenantId,
          authorTenantId: auditTenantId,
          supportCase: await requireVisibleSupportCase(
            client,
            actor,
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
    this.caseAnnouncer.announceChange(posted.supportCase.tenant_id, {
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
    const change = await this.databaseService.withActor(actor, (client) =>
      reopenSupportCase(client, actor, caseNumber),
    );
    return this.caseAnnouncer.announceChange(change.row.tenant_id, {
      ...change,
      actorId: actor.userId,
      previousAssigneeId: null,
    });
  };

  // The machine's owning organisation, where its case belongs. A machine
  // outside the caller's scope is a 400; a view-only share a 403.
  private requireCaseMachineOwner = async (
    client: PoolClient,
    machineId: string,
  ): Promise<string> => {
    try {
      return (await requireMachineAccess(client, machineId, 'contribute'))
        .tenantId;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(UNKNOWN_MACHINE_MESSAGE);
      }
      throw error;
    }
  };
}
