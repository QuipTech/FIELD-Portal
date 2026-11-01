import { AuthenticatedUser } from '../../src/auth/types/authenticatedUser';
import { StorageService } from '../../src/storage/storage.service';
import { DashboardConfig } from '../../src/dashboard/dashboardConfig';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { CaseAnnouncer } from '../../src/supportCases/caseAnnouncer.service';
import { SupportCasesService } from '../../src/supportCases/supportCases.service';
import { MachineFleetService } from '../../src/machineFleet/machineFleet.service';
import { MachineHistoryService } from '../../src/machineHistory/machineHistory.service';
import { MachineConfigurationService } from '../../src/machineConfiguration/machineConfiguration.service';
import { AiAskContextService } from '../../src/aiAssistant/aiAskContext.service';
import { AiRetrievalService } from '../../src/aiAssistant/aiRetrieval.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { MachineGroupsService } from '../../src/machineGroups/machineGroups.service';
import { MachineAccessService } from '../../src/machineGroups/machineAccess.service';
import { BillingTestDatabase } from '../billing/billingTestDatabase';

// Pit Crew has two customer groups with a machine each, plus an ungrouped
// machine; Terry (tech) is limited to ABC Earthmoving, Ada (admin) sees
// everything. Old Co, another organisation, has a group with the same
// name and a machine of its own. Written as the migration owner, inside
// the spec's transaction.
export const seedMachineGroupWorld = async (fixture: BillingTestDatabase) => {
  const { ids, query, insertMachine } = fixture;
  const tenantId = ids.customerTenant;
  const group = async (tenant: string, name: string) =>
    (
      await query(
        'INSERT INTO machine_groups (tenant_id, name) VALUES ($1, $2) RETURNING id',
        [tenant, name],
      )
    ).rows[0].id as string;
  const machine = async (
    tenant: string,
    groupId: string | null,
    serial: string,
    plantId: string,
  ) => {
    const id = await insertMachine(tenant);
    await query(
      `UPDATE machines SET group_id = $2, asset_number = $3, serial_number = $4,
         registration_number = $5, lifecycle_state = 'active'
       WHERE id = $1`,
      [id, groupId, plantId, serial, `VIN-${serial}`],
    );
    const author = tenant === tenantId ? ids.customerAdmin : ids.setUpAdmin;
    await query(
      `INSERT INTO technical_history_entries (tenant_id, machine_id, entry_type, description, created_by)
       VALUES ($1, $2, 'service', $3, $4)`,
      [tenant, id, `Serviced ${serial}`, author],
    );
    return id;
  };
  const caseAbout = async (machineId: string | null, subject: string) =>
    (
      await query(
        `INSERT INTO support_cases (tenant_id, created_by, subject, priority, status, machine_id, sla_due_at)
         VALUES ($1, $2, $3, 'P2', 'open', $4, now() + interval '8 hours')
         RETURNING case_number`,
        [tenantId, ids.customerAdmin, subject, machineId],
      )
    ).rows[0].case_number as number;

  const abc = await group(tenantId, 'ABC Earthmoving');
  const xyz = await group(tenantId, 'XYZ Haulage');
  const oldCoGroup = await group(ids.setUpTenant, 'ABC Earthmoving');
  const abcMachine = await machine(tenantId, abc, 'ABC-001', 'PLANT-ABC');
  const xyzMachine = await machine(tenantId, xyz, 'XYZ-001', 'PLANT-XYZ');
  const looseMachine = await machine(
    tenantId,
    null,
    'LOOSE-001',
    'PLANT-LOOSE',
  );
  const oldCoMachine = await machine(
    ids.setUpTenant,
    oldCoGroup,
    'OLD-001',
    'PLANT-OLD',
  );
  await query(
    `UPDATE users SET machine_access_mode = 'selected' WHERE id = $1`,
    [ids.customerTech],
  );
  await query(
    `INSERT INTO user_machine_group_access (tenant_id, user_id, group_id)
     VALUES ($1, $2, $3)`,
    [tenantId, ids.customerTech, abc],
  );
  const cases = {
    abc: await caseAbout(abcMachine, 'ABC brakes'),
    xyz: await caseAbout(xyzMachine, 'XYZ hydraulics'),
    loose: await caseAbout(looseMachine, 'Loose engine'),
    none: await caseAbout(null, 'Portal question'),
  };
  return {
    tenantId,
    groups: { abc, xyz, oldCoGroup },
    machines: { abcMachine, xyzMachine, looseMachine, oldCoMachine },
    cases,
  };
};

export type MachineGroupWorld = Awaited<
  ReturnType<typeof seedMachineGroupWorld>
>;

export const actorsOf = (fixture: BillingTestDatabase) => {
  const as = (
    tenantId: string,
    userId: string,
    email: string,
  ): AuthenticatedUser => ({
    tenantId,
    userId,
    email,
  });
  return {
    admin: as(
      fixture.ids.customerTenant,
      fixture.ids.customerAdmin,
      'admin@pit.test',
    ),
    tech: as(
      fixture.ids.customerTenant,
      fixture.ids.customerTech,
      'tech@pit.test',
    ),
    oldCoAdmin: as(
      fixture.ids.setUpTenant,
      fixture.ids.setUpAdmin,
      'admin@old.test',
    ),
  };
};

// The real services over the test database; nothing here signs photos or
// streams answers.
export const servicesOf = (fixture: BillingTestDatabase) => {
  const { database } = fixture;
  const storage = {} as StorageService;
  const dashboardConfig = {
    slaHours: { P1: 4, P2: 8, P3: 24 },
  } as DashboardConfig;
  const retrieval = {
    assertScopeAllowed: jest.fn().mockResolvedValue(undefined),
    retrieveChunks: jest.fn().mockResolvedValue([]),
  } as unknown as AiRetrievalService;
  return {
    fleet: new MachineFleetService(database, storage),
    history: new MachineHistoryService(database, storage),
    configuration: new MachineConfigurationService(database),
    cases: new SupportCasesService(
      database,
      dashboardConfig,
      {} as CaseAnnouncer,
    ),
    ai: new AiAskContextService(database, retrieval),
    dashboard: new DashboardService(database, dashboardConfig, storage),
    notifications: new NotificationsService(database),
    groups: new MachineGroupsService(database),
    access: new MachineAccessService(database),
  };
};
