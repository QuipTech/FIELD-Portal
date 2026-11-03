import { AuthenticatedUser } from '../../src/auth/types/authenticatedUser';
import { StorageService } from '../../src/storage/storage.service';
import { DashboardConfig } from '../../src/dashboard/dashboardConfig';
import { CaseAnnouncer } from '../../src/supportCases/caseAnnouncer.service';
import { SupportCasesService } from '../../src/supportCases/supportCases.service';
import { MachineFleetService } from '../../src/machineFleet/machineFleet.service';
import { MachineDetailsService } from '../../src/machineFleet/machineDetails.service';
import { MachineHistoryService } from '../../src/machineHistory/machineHistory.service';
import { MachineConfigurationService } from '../../src/machineConfiguration/machineConfiguration.service';
import { AiAskContextService } from '../../src/aiAssistant/aiAskContext.service';
import { AiRetrievalService } from '../../src/aiAssistant/aiRetrieval.service';
import { MachineGroupsAdminService } from '../../src/machineSharing/groups/machineGroupsAdmin.service';
import { GroupMachinesAdminService } from '../../src/machineSharing/groups/groupMachinesAdmin.service';
import { GroupAssignmentsAdminService } from '../../src/machineSharing/groups/groupAssignmentsAdmin.service';
import { MachineSharesService } from '../../src/machineSharing/shares/machineShares.service';
import { UserMachineAccessService } from '../../src/machineSharing/userAccess/userMachineAccess.service';
import { BillingTestDatabase } from '../billing/billingTestDatabase';

// Pit Crew (organisation A) owns three active machines, each with a
// history entry and a case its admin raised. Old Co (organisation B) owns
// one machine and has a technician, Bea. QuipTech's Owner is the platform
// administrator. Nothing is shared yet: specs create the group. Written as
// the migration owner, inside the spec's transaction.
export const seedSharingWorld = async (fixture: BillingTestDatabase) => {
  const { ids, query, insertMachine } = fixture;
  const machine = async (tenantId: string, plantId: string, author: string) => {
    const id = await insertMachine(tenantId);
    await query(
      `UPDATE machines SET asset_number = $2, serial_number = $3,
         registration_number = $4, lifecycle_state = 'active', created_by = $5
       WHERE id = $1`,
      [id, plantId, `SER-${plantId}`, `VIN-${plantId}`, author],
    );
    await query(
      `INSERT INTO technical_history_entries (tenant_id, machine_id, entry_type, description, created_by)
       VALUES ($1, $2, 'service', $3, $4)`,
      [tenantId, id, `Serviced ${plantId}`, author],
    );
    const caseRow = await query(
      `INSERT INTO support_cases (tenant_id, created_by, subject, priority, status, machine_id, sla_due_at)
       VALUES ($1, $2, $3, 'P2', 'open', $4, now() + interval '8 hours')
       RETURNING case_number`,
      [tenantId, author, `Brakes on ${plantId}`, id],
    );
    return { id, caseNumber: Number(caseRow.rows[0].case_number) };
  };
  const techB = (
    await query(
      `INSERT INTO users (tenant_id, email, first_name, last_name, password_hash, status)
       VALUES ($1, 'bea@old.test', 'Bea', 'B', 'x', 'active') RETURNING id`,
      [ids.setUpTenant],
    )
  ).rows[0].id as string;
  await query(
    `INSERT INTO user_roles (tenant_id, user_id, role_id)
     SELECT $1, $2, id FROM roles WHERE name = 'Field Technician' AND is_system_role AND tenant_id IS NULL`,
    [ids.setUpTenant, techB],
  );
  return {
    techB,
    shared1: await machine(ids.customerTenant, 'PLANT-A1', ids.customerAdmin),
    shared2: await machine(ids.customerTenant, 'PLANT-A2', ids.customerAdmin),
    private3: await machine(ids.customerTenant, 'PLANT-A3', ids.customerAdmin),
    ownB: await machine(ids.setUpTenant, 'PLANT-B1', ids.setUpAdmin),
  };
};

export type SharingWorld = Awaited<ReturnType<typeof seedSharingWorld>>;

const as = (tenantId: string, userId: string): AuthenticatedUser => ({
  tenantId,
  userId,
  email: `${userId}@test`,
});

export const actorsOf = (
  fixture: BillingTestDatabase,
  world: SharingWorld,
) => ({
  owner: as(fixture.ids.platformTenant, fixture.ids.platformOwner),
  adminA: as(fixture.ids.customerTenant, fixture.ids.customerAdmin),
  techA: as(fixture.ids.customerTenant, fixture.ids.customerTech),
  techB: as(fixture.ids.setUpTenant, world.techB),
});

// The real services over the test database; nothing here signs photos or
// streams answers.
export const servicesOf = (fixture: BillingTestDatabase) => {
  const { database } = fixture;
  const storage = {} as StorageService;
  const retrieval = {
    assertScopeAllowed: jest.fn().mockResolvedValue(undefined),
    retrieveChunks: jest.fn().mockResolvedValue([]),
  } as unknown as AiRetrievalService;
  return {
    fleet: new MachineFleetService(database, storage),
    details: new MachineDetailsService(database, storage),
    history: new MachineHistoryService(database, storage),
    configuration: new MachineConfigurationService(database),
    cases: new SupportCasesService(
      database,
      { slaHours: { P1: 4, P2: 8, P3: 24 } } as DashboardConfig,
      { announceChange: jest.fn() } as unknown as CaseAnnouncer,
    ),
    ai: new AiAskContextService(database, retrieval),
    groups: new MachineGroupsAdminService(database),
    groupMachines: new GroupMachinesAdminService(database),
    assignments: new GroupAssignmentsAdminService(database),
    shares: new MachineSharesService(database),
    userAccess: new UserMachineAccessService(database),
  };
};

// The Owner's group holding Pit Crew's first two machines.
export const createSharedGroup = async (
  services: ReturnType<typeof servicesOf>,
  owner: AuthenticatedUser,
  world: SharingWorld,
) => {
  const group = await services.groups.createGroup(owner, {
    name: 'TRT shared',
  });
  await services.groupMachines.addMachines(owner, group.id, [
    world.shared1.id,
    world.shared2.id,
  ]);
  return group;
};
