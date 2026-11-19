import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as authRepository from '../../auth/auth.repository';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { DatabaseService } from '../../database/database.service';

export interface MachineControlOrganisation {
  id: string;
  name: string;
  machineControlEnabled: boolean;
  activeMachineCount: number;
  connectedDeviceCount: number;
}

interface OrganisationRow {
  id: string;
  name: string;
  machine_control_enabled: boolean;
  active_machine_count: number;
  connected_device_count: number;
}

const INSUFFICIENT_PRIVILEGE = '42501';

// The functions refuse anyone but the platform administrator; that's a 403.
const asForbidden = (error: unknown): never => {
  if ((error as { code?: string })?.code === INSUFFICIENT_PRIVILEGE) {
    throw new ForbiddenException(
      'Only the platform administrator can do this.',
    );
  }
  throw error;
};

const toOrganisation = (row: OrganisationRow): MachineControlOrganisation => ({
  id: row.id,
  name: row.name,
  machineControlEnabled: row.machine_control_enabled,
  activeMachineCount: row.active_machine_count,
  connectedDeviceCount: row.connected_device_count,
});

// Admin portal → Machine Control: the platform administrator turns the module
// on per organisation. The database functions check it's really them.
@Injectable()
export class AdminMachineControlService {
  constructor(private readonly databaseService: DatabaseService) {}

  listOrganisations = (
    actor: AuthenticatedUser,
    search: string | undefined,
  ): Promise<MachineControlOrganisation[]> =>
    this.databaseService
      .withActor(actor, async (client) => {
        const result = await client.query<OrganisationRow>(
          'SELECT * FROM admin_list_machine_control_organisations($1)',
          [search ?? null],
        );
        return result.rows.map(toOrganisation);
      })
      .catch(asForbidden);

  setEnabled = (
    actor: AuthenticatedUser,
    tenantId: string,
    enabled: boolean,
  ): Promise<{ id: string; machineControlEnabled: boolean }> =>
    this.databaseService
      .withActor(actor, async (client) => {
        const result = await client.query<{ name: string | null }>(
          'SELECT admin_set_machine_control($1, $2) AS name',
          [tenantId, enabled],
        );
        const name = result.rows[0].name;
        if (!name) throw new NotFoundException('Organisation not found.');
        await authRepository.insertAuditLog(client, {
          tenantId: actor.tenantId,
          userId: actor.userId,
          action: 'update',
          entityType: 'machine_control_setting',
          entityId: tenantId,
          metadata: { organisationName: name, enabled },
        });
        return { id: tenantId, machineControlEnabled: enabled };
      })
      .catch(asForbidden);
}
