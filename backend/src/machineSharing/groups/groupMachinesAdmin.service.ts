import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { insertAuditLog } from '../../auth/auth.repository';
import {
  AuditEntry,
  runAuditedChange,
} from '../../common/audit/runAuditedChange';
import * as machinesRepository from './groupMachines.repository';
import { auditForMachineOwners } from './auditForMachineOwners';
import { requireGroup } from './machineGroupsAdmin.service';
import { toGroupMachine, toPlatformMachine } from './machineGroupsMapper';
import { SearchMachinesQueryDto } from '../dto/machineGroupDtos';
import { GroupMachine, PlatformMachine } from '../types/machineGroupTypes';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
const NOT_IN_GROUP_MESSAGE = "That machine isn't in this group.";
const DEFAULT_SEARCH_LIMIT = 25;

interface AuditedMachine {
  id: string;
  label: string;
  tenant_id: string;
}

const machinesAddedAudit = (
  group: { id: string; name: string },
  machines: AuditedMachine[],
): AuditEntry => ({
  action: 'update',
  entityType: 'machine_group',
  entityId: group.id,
  metadata: {
    name: group.name,
    change: 'machines_added',
    machines: machines.map((machine) => ({
      id: machine.id,
      label: machine.label,
      organisationId: machine.tenant_id,
    })),
  },
});

const machineRemovedAudit = (
  group: { id: string; name: string },
  machineId: string,
  machine: AuditedMachine | undefined,
): AuditEntry => ({
  action: 'update',
  entityType: 'machine_group',
  entityId: group.id,
  metadata: {
    name: group.name,
    change: 'machine_removed',
    machine: machine
      ? {
          id: machineId,
          label: machine.label,
          organisationId: machine.tenant_id,
        }
      : { id: machineId },
  },
});

// Which machines a global group holds, from any organisation. A machine
// joining or leaving a group is audited for the platform administrator and
// in each owning organisation's log; who can see it changes on the next
// request.
@Injectable()
export class GroupMachinesAdminService {
  constructor(private readonly databaseService: DatabaseService) {}

  listMachines = (
    actor: AuthenticatedUser,
    groupId: string,
  ): Promise<GroupMachine[]> =>
    this.databaseService.withActor(actor, async (client) => {
      await requireGroup(client, groupId);
      const rows = await machinesRepository.listGroupMachines(client, groupId);
      return rows.map(toGroupMachine);
    });

  searchMachines = (
    actor: AuthenticatedUser,
    query: SearchMachinesQueryDto,
  ): Promise<PlatformMachine[]> =>
    this.databaseService.withActor(actor, async (client) => {
      const rows = await machinesRepository.searchPlatformMachines(client, {
        search: query.search,
        limit: query.limit ?? DEFAULT_SEARCH_LIMIT,
      });
      return rows.map(toPlatformMachine);
    });

  // All or nothing: an unknown machine is a 404 and nothing is added.
  addMachines = (
    actor: AuthenticatedUser,
    groupId: string,
    machineIds: string[],
  ): Promise<GroupMachine[]> =>
    runAuditedChange(this.databaseService, actor, '', async (client) => {
      const group = await requireGroup(client, groupId);
      const machines = await machinesRepository.findPlatformMachines(
        client,
        machineIds,
      );
      if (machines.length !== new Set(machineIds).size) {
        throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
      }
      const added = new Set(
        await machinesRepository.insertGroupMachines(client, {
          groupId,
          machineIds,
          addedBy: actor.userId,
        }),
      );
      const addedMachines = machines.filter((machine) => added.has(machine.id));
      const audit = machinesAddedAudit(group, addedMachines);
      await auditForMachineOwners(
        client,
        actor,
        addedMachines.map((machine) => machine.tenant_id),
        audit,
      );
      const rows = await machinesRepository.listGroupMachines(client, groupId);
      return { result: rows.map(toGroupMachine), audit };
    });

  removeMachine = (
    actor: AuthenticatedUser,
    groupId: string,
    machineId: string,
  ): Promise<void> =>
    runAuditedChange(this.databaseService, actor, '', async (client) => {
      const group = await requireGroup(client, groupId);
      const [machine] = await machinesRepository.findPlatformMachines(client, [
        machineId,
      ]);
      const removed = await machinesRepository.deleteGroupMachine(client, {
        groupId,
        machineId,
      });
      if (!removed) throw new NotFoundException(NOT_IN_GROUP_MESSAGE);
      const audit = machineRemovedAudit(group, machineId, machine);
      if (machine) {
        await auditForMachineOwners(client, actor, [machine.tenant_id], audit);
      }
      return { result: undefined, audit };
    });

  listMachineGroups = (
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<{ id: string; name: string }[]> =>
    this.databaseService.withActor(actor, async (client) => {
      await this.requireMachine(client, machineId);
      return machinesRepository.listMachineGroups(client, machineId);
    });

  // Makes the machine's groups exactly groupIds, in one transaction, so moving
  // it never leaves it half shared. An unknown machine or group is a 404 and
  // nothing changes. Each group added or left gets the same audit entry as
  // changing it from the group's own page.
  setMachineGroups = (
    actor: AuthenticatedUser,
    machineId: string,
    groupIds: string[],
  ): Promise<{ id: string; name: string }[]> =>
    this.databaseService.withActor(actor, async (client) => {
      const machine = await this.requireMachine(client, machineId);
      const current = await machinesRepository.listMachineGroups(
        client,
        machineId,
      );
      const currentIds = new Set(current.map((group) => group.id));
      const wanted = new Set(groupIds);
      const writeAudit = async (entry: AuditEntry) => {
        await insertAuditLog(client, {
          ...entry,
          tenantId: actor.tenantId,
          userId: actor.userId,
        });
        await auditForMachineOwners(client, actor, [machine.tenant_id], entry);
      };

      for (const groupId of groupIds.filter((id) => !currentIds.has(id))) {
        const group = await requireGroup(client, groupId);
        await machinesRepository.insertGroupMachines(client, {
          groupId,
          machineIds: [machineId],
          addedBy: actor.userId,
        });
        await writeAudit(machinesAddedAudit(group, [machine]));
      }
      for (const group of current.filter((row) => !wanted.has(row.id))) {
        await machinesRepository.deleteGroupMachine(client, {
          groupId: group.id,
          machineId,
        });
        await writeAudit(machineRemovedAudit(group, machineId, machine));
      }
      return machinesRepository.listMachineGroups(client, machineId);
    });

  private requireMachine = async (
    client: PoolClient,
    machineId: string,
  ): Promise<AuditedMachine> => {
    const [machine] = await machinesRepository.findPlatformMachines(client, [
      machineId,
    ]);
    if (!machine) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
    return machine;
  };
}
