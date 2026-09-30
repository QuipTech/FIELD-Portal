import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as casesRepository from './supportCases.repository';
import * as optionsRepository from './caseOptions.repository';
import { insertCaseMessage } from './caseMessages.repository';
import { requireSupportCase } from './requireSupportCase';
import { CaseEventsPublisher } from './caseEventsPublisher';
import { toPerson, toStatusCounts, toSupportCase } from './supportCaseMapper';
import { ListSupportCasesQueryDto } from './dto/listSupportCasesQueryDto';
import { CreateSupportCaseDto } from './dto/createSupportCaseDto';
import { UpdateSupportCaseDto } from './dto/updateSupportCaseDto';
import {
  SupportCase,
  SupportCaseList,
  SupportCaseOptions,
} from './types/supportCaseResponse';

const UNKNOWN_MACHINE_MESSAGE = 'That machine is not in your organisation.';
const UNASSIGNABLE_MESSAGE =
  "That person can't take support cases (they need the Manage support cases permission).";

// Support cases within the caller's own organisation (tenantId from the
// JWT). Each change is pushed to connected portals once committed.
@Injectable()
export class SupportCasesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly caseEventsPublisher: CaseEventsPublisher,
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

  getOptions = async (actor: AuthenticatedUser): Promise<SupportCaseOptions> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const users = await optionsRepository.listAssignableUsers(
        client,
        actor.tenantId,
      );
      const machines = await optionsRepository.listMachineOptions(
        client,
        actor.tenantId,
      );
      return {
        assignees: users.flatMap(
          (user) => toPerson(user.id, user.first_name, user.last_name) ?? [],
        ),
        machines: machines.map((machine) => ({
          id: machine.id,
          label: machine.label,
          modelName: machine.model_name,
        })),
      };
    });

  // The description becomes the case's first message, in one transaction.
  createCase = async (
    actor: AuthenticatedUser,
    dto: CreateSupportCaseDto,
  ): Promise<SupportCase> => {
    const created = await this.databaseService.withTenant(
      actor.tenantId,
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
          category: dto.category,
          priority: dto.priority,
          machineId: dto.machineId ?? null,
        });
        await insertCaseMessage(client, {
          tenantId: actor.tenantId,
          caseId: inserted.id,
          authorId: actor.userId,
          body: dto.description,
        });
        const caseNumber = Number(inserted.case_number);
        return toSupportCase(
          await requireSupportCase(client, actor.tenantId, caseNumber),
        );
      },
    );
    this.caseEventsPublisher.publishCaseUpdated(actor.tenantId, created);
    return created;
  };

  updateCase = async (
    actor: AuthenticatedUser,
    caseNumber: number,
    dto: UpdateSupportCaseDto,
  ): Promise<SupportCase> => {
    const updated = await this.databaseService.withTenant(
      actor.tenantId,
      async (client) => {
        const existing = await requireSupportCase(
          client,
          actor.tenantId,
          caseNumber,
        );
        if (dto.assigneeId) {
          const assignable = await optionsRepository.listAssignableUsers(
            client,
            actor.tenantId,
          );
          if (!assignable.some((user) => user.id === dto.assigneeId)) {
            throw new BadRequestException(UNASSIGNABLE_MESSAGE);
          }
        }
        await casesRepository.updateCase(client, {
          tenantId: actor.tenantId,
          caseId: existing.id,
          patch: dto,
        });
        return toSupportCase(
          await requireSupportCase(client, actor.tenantId, caseNumber),
        );
      },
    );
    this.caseEventsPublisher.publishCaseUpdated(actor.tenantId, updated);
    return updated;
  };
}
