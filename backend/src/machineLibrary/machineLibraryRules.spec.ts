import {
  buildSystemTree,
  normalizeImportedSystems,
  toMachineModelSummary,
} from './machineLibraryRules';

describe('toMachineModelSummary', () => {
  it('joins manufacturer and model into the display name and parses counts', () => {
    expect(
      toMachineModelSummary({
        id: 'm1',
        manufacturer_name: 'CAT',
        name: '793F',
        product_family: 'haul truck',
        systems_count: '6',
        assets_count: '42',
      }),
    ).toEqual({
      id: 'm1',
      manufacturerName: 'CAT',
      name: '793F',
      displayName: 'CAT 793F',
      category: 'haul truck',
      systemsCount: 6,
      assetsCount: 42,
    });
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
