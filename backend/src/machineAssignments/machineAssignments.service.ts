import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import { assertMachineInTenant } from '../machineHistory/machineHistory.service';
import * as assignmentsRepository from './machineAssignments.repository';
import {
  AssignedTechnician,
  toAssignedTechnician,
} from './assignedTechnicianMapper';

const NOT_IN_ORGANISATION_MESSAGE = "That person isn't in your organisation.";
const NOT_ASSIGNED_MESSAGE = "That person isn't assigned to this machine.";

// Technicians assigned to a machine, within the caller's organisation.
// Assigning someone already assigned is a no-op; both changes are audited.
@Injectable()
export class MachineAssignmentsService {
  constructor(private readonly databaseService: DatabaseService) {}

  listTechnicians = (
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<AssignedTechnician[]> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      await assertMachineInTenant(client, actor.tenantId, machineId);
      return this.loadTechnicians(client, actor.tenantId, machineId);
    });

  assignTechnician = (
    actor: AuthenticatedUser,
    machineId: string,
    userId: string,
  ): Promise<AssignedTechnician[]> =>
    runAuditedChange(this.databaseService, actor, '', async (client) => {
      const machine = await assertMachineInTenant(
        client,
        actor.tenantId,
        machineId,
      );
      if (
        !(await assignmentsRepository.isOrganisationUser(
          client,
          actor.tenantId,
          userId,
        ))
      ) {
        throw new BadRequestException(NOT_IN_ORGANISATION_MESSAGE);
      }
      await assignmentsRepository.insertAssignment(client, {
        tenantId: actor.tenantId,
        machineId,
        userId,
        assignedBy: actor.userId,
      });
      return {
        result: await this.loadTechnicians(client, actor.tenantId, machineId),
        audit: {
          action: 'create',
          entityType: 'machine_assignment',
          entityId: machineId,
          metadata: { name: machine.label, userId },
        },
      };
    });

  unassignTechnician = (
    actor: AuthenticatedUser,
    machineId: string,
    userId: string,
  ): Promise<void> =>
    runAuditedChange(this.databaseService, actor, '', async (client) => {
      const machine = await assertMachineInTenant(
        client,
        actor.tenantId,
        machineId,
      );
      const removed = await assignmentsRepository.deleteAssignment(client, {
        tenantId: actor.tenantId,
        machineId,
        userId,
      });
      if (!removed) throw new NotFoundException(NOT_ASSIGNED_MESSAGE);
      return {
        result: undefined,
        audit: {
          action: 'delete',
          entityType: 'machine_assignment',
          entityId: machineId,
          metadata: { name: machine.label, userId },
        },
      };
    });

  private loadTechnicians = async (
    client: PoolClient,
    tenantId: string,
    machineId: string,
  ): Promise<AssignedTechnician[]> =>
    (
      await assignmentsRepository.listAssignedTechnicians(
        client,
        tenantId,
        machineId,
      )
    ).map(toAssignedTechnician);
}
