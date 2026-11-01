import {
  ALL_MACHINES,
  isMachineAccessAdmin,
  machineInScopeSql,
  resolveMachineScope,
  toScopeParam,
} from './machineScope';

describe('resolveMachineScope', () => {
  it("gives every machine to people on 'all'", () => {
    expect(
      resolveMachineScope({ isAdmin: false, mode: 'all', groupIds: ['g1'] }),
    ).toEqual(ALL_MACHINES);
  });

  it("limits 'selected' people to their groups", () => {
    expect(
      resolveMachineScope({
        isAdmin: false,
        mode: 'selected',
        groupIds: ['g1', 'g2'],
      }),
    ).toEqual({ kind: 'groups', groupIds: ['g1', 'g2'] });
  });

  it('gives admins every machine even when stored as selected', () => {
    expect(
      resolveMachineScope({ isAdmin: true, mode: 'selected', groupIds: [] }),
    ).toEqual(ALL_MACHINES);
  });

  it("leaves a 'selected' person whose groups are all gone with nothing", () => {
    expect(
      resolveMachineScope({ isAdmin: false, mode: 'selected', groupIds: [] }),
    ).toEqual({ kind: 'groups', groupIds: [] });
  });
});

describe('isMachineAccessAdmin', () => {
  it('is true for organisation admins and the platform administrator', () => {
    expect(isMachineAccessAdmin(['admin.manage_users'])).toBe(true);
    expect(isMachineAccessAdmin(['platform.manage'])).toBe(true);
    expect(isMachineAccessAdmin(['machine.view', 'machine.manage'])).toBe(
      false,
    );
  });
});

describe('scope SQL', () => {
  it('passes null for every machine and the group ids otherwise', () => {
    expect(toScopeParam(ALL_MACHINES)).toBeNull();
    expect(toScopeParam({ kind: 'groups', groupIds: [] })).toEqual([]);
  });

  it('matches every machine for a null parameter, else only listed groups', () => {
    expect(machineInScopeSql('m', '$2')).toBe(
      '($2::uuid[] IS NULL OR m.group_id = ANY($2::uuid[]))',
    );
  });
});
