import { ListMachinesQueryDto } from '../../src/machineFleet/dto/listMachinesQueryDto';
import { AuthenticatedUser } from '../../src/auth/types/authenticatedUser';
import {
  BillingTestDatabase,
  createBillingTestDatabase,
} from '../billing/billingTestDatabase';
import {
  actorsOf,
  createSharedGroup,
  seedSharingWorld,
  servicesOf,
  SharingWorld,
} from './machineSharingFixtures';

// The platform administrator's group changes (audited for them and for
// each owning organisation) and the owning organisation's admin listing and
// withdrawing shares of its own machines.
describe('machine shares and their audit', () => {
  let fixture: BillingTestDatabase;
  let world: SharingWorld;
  let services: ReturnType<typeof servicesOf>;
  let actors: ReturnType<typeof actorsOf>;

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    services = servicesOf(fixture);
  });
  afterAll(() => fixture.db.close());
  beforeEach(async () => {
    await fixture.db.exec('BEGIN');
    world = await seedSharingWorld(fixture);
    actors = actorsOf(fixture, world);
  });
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const listIds = async (actor: AuthenticatedUser) =>
    (await services.fleet.listMachines(actor, new ListMachinesQueryDto())).items
      .map((machine) => machine.id)
      .sort();
  // Sorted: one spec transaction gives every entry the same created_at.
  const auditChanges = async (tenantId: string) =>
    (
      await fixture.query(
        `SELECT entity_type, metadata->>'change' AS change FROM audit_logs
         WHERE tenant_id = $1 AND entity_type IN ('machine_group', 'machine')`,
        [tenantId],
      )
    ).rows
      .map((row) => `${row.entity_type}:${row.change ?? 'created'}`)
      .sort();
  const shareWithB = async (accessLevel: 'view' | 'contribute' = 'view') => {
    const group = await createSharedGroup(services, actors.owner, world);
    const assignments = await services.assignments.grant(
      actors.owner,
      group.id,
      {
        targetType: 'organisation',
        targetId: fixture.ids.setUpTenant,
        accessLevel,
      },
    );
    return { group, assignment: assignments[0] };
  };

  it('lets only the platform administrator create groups or assignments', async () => {
    await expect(
      services.groups.createGroup(actors.adminA, { name: 'Sneaky' }),
    ).rejects.toThrow();
    const { group } = await shareWithB();
    await expect(
      services.assignments.grant(actors.adminA, group.id, {
        targetType: 'organisation',
        targetId: fixture.ids.customerTenant,
        accessLevel: 'contribute',
      }),
    ).rejects.toThrow();
  });

  it("audits group changes for the platform administrator and in the owner's log", async () => {
    const { group, assignment } = await shareWithB();
    const changed = await services.assignments.grant(actors.owner, group.id, {
      targetType: 'organisation',
      targetId: fixture.ids.setUpTenant,
      accessLevel: 'contribute',
    });
    expect(changed).toEqual([
      expect.objectContaining({ id: assignment.id, accessLevel: 'contribute' }),
    ]);
    await services.assignments.revoke(
      actors.owner,
      { groupId: group.id, assignmentId: assignment.id },
      'Contract ended',
    );
    const groupChanges = [
      'machine_group:assignment_granted',
      'machine_group:assignment_level_changed',
      'machine_group:assignment_revoked',
      'machine_group:machines_added',
    ];
    expect(await auditChanges(fixture.ids.platformTenant)).toEqual(
      ['machine_group:created', ...groupChanges].sort(),
    );
    expect(await auditChanges(fixture.ids.customerTenant)).toEqual(
      groupChanges,
    );
    const activity = await services.groups.listActivity(actors.owner, group.id);
    expect(activity.map((entry) => entry.metadata)).toContainEqual(
      expect.objectContaining({ reason: 'Contract ended' }),
    );
  });

  it("lets the owning admin list and withdraw one machine's share, and tells the platform administrator", async () => {
    const { group, assignment } = await shareWithB();
    const shares = await services.shares.listShares(
      actors.adminA,
      world.shared1.id,
    );
    expect(shares).toEqual([
      expect.objectContaining({
        assignmentId: assignment.id,
        group: expect.objectContaining({ id: group.id }),
        targetType: 'organisation',
        targetName: 'Old Co',
        accessLevel: 'view',
        withdrawnAt: null,
      }),
    ]);
    const after = await services.shares.withdrawShare(
      actors.adminA,
      { machineId: world.shared1.id, assignmentId: assignment.id },
      'Not covered by contract',
    );
    expect(after[0].withdrawnReason).toBe('Not covered by contract');
    expect(await listIds(actors.techB)).toEqual(
      [world.ownB.id, world.shared2.id].sort(),
    );
    expect(await auditChanges(fixture.ids.customerTenant)).toContain(
      'machine:share_withdrawn',
    );
    const notified = await fixture.query(
      `SELECT title FROM notifications WHERE user_id = $1 AND kind = 'machine_sharing'`,
      [fixture.ids.platformOwner],
    );
    expect(notified.rows).toEqual([
      { title: 'Pit Crew withdrew PLANT-A1 from TRT shared' },
    ]);
  });

  it("404s shares of a machine the caller's organisation doesn't own", async () => {
    await shareWithB('contribute');
    await expect(
      services.shares.listShares(actors.techB, world.shared1.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('ends every assignment when a group is deleted', async () => {
    const { group } = await shareWithB();
    await services.groups.deleteGroup(actors.owner, group.id);
    expect(await listIds(actors.techB)).toEqual([world.ownB.id]);
    const open = await fixture.query(
      'SELECT count(*)::int AS n FROM machine_group_assignments WHERE group_id = $1 AND revoked_at IS NULL',
      [group.id],
    );
    expect(open.rows[0].n).toBe(0);
  });
});
