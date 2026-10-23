import { isTeamAssignableRole } from './teamRoleRules';

describe('isTeamAssignableRole', () => {
  it('allows ordinary organisation roles', () => {
    expect(isTeamAssignableRole(['machine.view', 'ai.use'])).toBe(true);
  });

  it.each([['platform.manage'], ['support.agent'], ['support.manage']])(
    'refuses a role granting %s',
    (code) => {
      expect(isTeamAssignableRole(['machine.view', code])).toBe(false);
    },
  );
});
