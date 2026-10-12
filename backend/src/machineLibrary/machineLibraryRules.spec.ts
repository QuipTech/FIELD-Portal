import {
  buildSystemTree,
  normalizeImportedSystems,
  toMachineModelSummary,
} from './machineLibraryRules';

describe('toMachineModelSummary', () => {
  const sharedRow = {
    id: 'm1',
    manufacturer_name: 'CAT',
    name: '793F',
    product_family: 'haul truck',
    tenant_id: null,
    organisation_name: null,
    systems_count: '6',
    assets_count: '42',
  };
  const organisationScope = { tenantId: 'org-a', isPlatform: false };

  it('joins manufacturer and model into the display name and parses counts', () => {
    expect(toMachineModelSummary(sharedRow, organisationScope)).toEqual({
      id: 'm1',
      manufacturerName: 'CAT',
      name: '793F',
      displayName: 'CAT 793F',
      category: 'haul truck',
      organisation: null,
      isEditable: false,
      systemsCount: 6,
      assetsCount: 42,
    });
  });

  it('limits an organisation scope to its own models', () => {
    const own = { ...sharedRow, tenant_id: 'org-a', organisation_name: 'A' };
    const other = { ...sharedRow, tenant_id: 'org-b', organisation_name: 'B' };
    expect(toMachineModelSummary(own, organisationScope).isEditable).toBe(true);
    expect(toMachineModelSummary(other, organisationScope).isEditable).toBe(
      false,
    );
  });

  it('lets the Owner (platform scope) edit every model, shared included', () => {
    const platform = { tenantId: null, isPlatform: true };
    expect(toMachineModelSummary(sharedRow, platform).isEditable).toBe(true);
  });
});

describe('buildSystemTree', () => {
  it('groups components under their system in row order', () => {
    const tree = buildSystemTree('m1', [
      {
        system_id: 's1',
        system_name: 'Powertrain',
        component_id: 'c1',
        component_name: 'Engine',
      },
      {
        system_id: 's1',
        system_name: 'Powertrain',
        component_id: 'c2',
        component_name: 'Torque converter',
      },
      {
        system_id: 's2',
        system_name: 'Brakes',
        component_id: null,
        component_name: null,
      },
    ]);
    expect(tree).toEqual({
      modelId: 'm1',
      systems: [
        {
          id: 's1',
          name: 'Powertrain',
          componentCount: 2,
          components: [
            { id: 'c1', name: 'Engine' },
            { id: 'c2', name: 'Torque converter' },
          ],
        },
        { id: 's2', name: 'Brakes', componentCount: 0, components: [] },
      ],
    });
  });
});

describe('normalizeImportedSystems', () => {
  it('merges systems named twice and drops repeated components, ignoring case', () => {
    expect(
      normalizeImportedSystems([
        { name: 'Hydraulics', components: ['Pump', 'pump'] },
        { name: 'hydraulics', components: ['Valve', 'PUMP'] },
        { name: 'Chassis', components: [] },
      ]),
    ).toEqual([
      { name: 'Hydraulics', components: ['Pump', 'Valve'] },
      { name: 'Chassis', components: [] },
    ]);
  });
});
