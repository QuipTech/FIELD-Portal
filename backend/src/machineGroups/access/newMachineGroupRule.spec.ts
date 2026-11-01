import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ALL_MACHINES } from './machineScope';
import { resolveNewMachineGroup } from './newMachineGroupRule';

const limited = { kind: 'groups' as const, groupIds: ['g1', 'g2'] };

describe('resolveNewMachineGroup', () => {
  it('lets an admin pick any group, or none', () => {
    expect(
      resolveNewMachineGroup({
        scope: ALL_MACHINES,
        isAdmin: true,
        groupId: 'g9',
      }),
    ).toBe('g9');
    expect(
      resolveNewMachineGroup({
        scope: ALL_MACHINES,
        isAdmin: true,
        groupId: null,
      }),
    ).toBeNull();
  });

  it('registers ungrouped machines for everyone else on all machines', () => {
    expect(
      resolveNewMachineGroup({
        scope: ALL_MACHINES,
        isAdmin: false,
        groupId: null,
      }),
    ).toBeNull();
    expect(() =>
      resolveNewMachineGroup({
        scope: ALL_MACHINES,
        isAdmin: false,
        groupId: 'g1',
      }),
    ).toThrow(ForbiddenException);
  });

  it('makes people limited to groups pick one of theirs', () => {
    expect(
      resolveNewMachineGroup({ scope: limited, isAdmin: false, groupId: 'g2' }),
    ).toBe('g2');
    expect(() =>
      resolveNewMachineGroup({ scope: limited, isAdmin: false, groupId: null }),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveNewMachineGroup({ scope: limited, isAdmin: false, groupId: 'g3' }),
    ).toThrow(BadRequestException);
  });
});
