import { resolveAdminScope } from './adminScope';

describe('resolveAdminScope', () => {
  it('gives an Owner (platform.manage) every organisation', () => {
    expect(
      resolveAdminScope({
        roles: ['Owner'],
        permissions: ['ai.use', 'platform.manage'],
      }),
    ).toEqual({ tenantId: null, isPlatform: true });
  });

  it('refuses anyone else, even with every other permission', () => {
    expect(
      resolveAdminScope({
        roles: ['Technical Manager'],
        permissions: ['audit.view', 'machine.manage', 'knowledge.submit'],
      }),
    ).toBeNull();
  });
});
