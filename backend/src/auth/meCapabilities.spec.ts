import { toMeCapabilities } from './meCapabilities';

describe('toMeCapabilities', () => {
  it('derives each flag from its permission code', () => {
    expect(
      toMeCapabilities(['knowledge.publish', 'ai.use', 'machine.view']),
    ).toEqual({
      isPlatformAdmin: false,
      isOrganisationAdmin: false,
      isKnowledgeAdmin: true,
      isSupportStaff: false,
      canUseAi: true,
      canManageMachines: false,
    });
  });

  it('marks the platform admin', () => {
    expect(toMeCapabilities(['platform.manage']).isPlatformAdmin).toBe(true);
  });
});
