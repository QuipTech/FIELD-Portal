import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { runAuditedChange } from '../../common/audit/runAuditedChange';
import * as machinesRepository from './groupMachines.repository';
import { auditForMachineOwners } from './auditForMachineOwners';
import { requireGroup } from './machineGroupsAdmin.service';
import { toGroupMachine, toPlatformMachine } from './machineGroupsMapper';
import { SearchMachinesQueryDto } from '../dto/machineGroupDtos';
import { GroupMachine, PlatformMachine } from '../types/machineGroupTypes';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
const NOT_IN_GROUP_MESSAGE = "That machine isn't in this group.";
const DEFAULT_SEARCH_LIMIT = 25;

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
      const audit = {
        action: 'update' as const,
        entityType: 'machine_group',
        entityId: groupId,
        metadata: {
          name: group.name,
          change: 'machines_added',
          machines: addedMachines.map((machine) => ({
            id: machine.id,
            label: machine.label,
            organisationId: machine.tenant_id,
          })),
        },
      };
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
      const audit = {
        action: 'update' as const,
        entityType: 'machine_group',
        entityId: groupId,
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
      };
      if (machine) {
        await auditForMachineOwners(client, actor, [machine.tenant_id], audit);
      }
      return { result: undefined, audit };
    });
}
