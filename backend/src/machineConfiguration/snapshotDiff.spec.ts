import { diffSnapshotItems } from './snapshotDiff';
import { SnapshotItemRow } from './types/machineConfigurationRows';

const item = (
  componentName: string,
  changes: Partial<SnapshotItemRow> = {},
): SnapshotItemRow => ({
  system_name: 'Hydraulics',
  component_name: componentName,
  serial_number: null,
  firmware_version: null,
  software_version: null,
  ...changes,
});

describe('diffSnapshotItems', () => {
  it('reports changed, added, removed and unchanged components', () => {
    const before = [
      item('Main pump', { serial_number: '4T-9231' }),
      item('Filter kit'),
      item('Tank'),
    ];
    const after = [
      item('Main pump', { serial_number: '4T-9455' }),
      item('Temp sensor', { serial_number: '88-2041' }),
      item('Tank'),
    ];

    const diff = diffSnapshotItems(before, after);

    expect(diff.rows).toEqual([
      {
        kind: 'changed',
        systemName: 'Hydraulics',
        componentName: 'Main pump',
        before: 'S/N 4T-9231',
        after: 'S/N 4T-9455',
        fields: [
          { field: 'serialNumber', before: '4T-9231', after: '4T-9455' },
        ],
      },
      {
        kind: 'added',
        systemName: 'Hydraulics',
        componentName: 'Temp sensor',
        before: null,
        after: 'S/N 88-2041',
        fields: [{ field: 'serialNumber', before: null, after: '88-2041' }],
      },
      {
        kind: 'removed',
        systemName: 'Hydraulics',
        componentName: 'Filter kit',
        before: 'Fitted',
        after: null,
        fields: [],
      },
    ]);
    expect(diff.unchanged).toEqual([
      { componentName: 'Tank', value: 'Fitted' },
    ]);
  });

  it('lists each changed field separately', () => {
    const diff = diffSnapshotItems(
      [item('ECU', { firmware_version: 'v4.13', software_version: '2.0' })],
      [item('ECU', { firmware_version: 'v4.14', software_version: '2.0' })],
    );

    expect(diff.rows[0].fields).toEqual([
      { field: 'firmwareVersion', before: 'v4.13', after: 'v4.14' },
    ]);
  });

  it('matches components by system as well as name', () => {
    const diff = diffSnapshotItems(
      [item('Seal')],
      [item('Seal', { system_name: 'Brakes' })],
    );

    expect(diff.rows.map((row) => row.kind)).toEqual(['added', 'removed']);
  });
});
