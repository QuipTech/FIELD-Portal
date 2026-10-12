import { diffSnapshotItems } from './snapshotDiff';
import { SnapshotItemRow } from './types/machineConfigurationRows';

const item = (componentName: string, changes: Partial<SnapshotItemRow> = {}): SnapshotItemRow => ({
  system_name: 'Hydraulics',
  component_name: componentName,
  serial_number: null,
  firmware_version: null,
  software_version: null,
  ...changes,
});

describe('diffSnapshotItems', () => {
  it('reports changed, added, removed and unchanged components', () => {
    const before = [item('Main pump', { serial_number: '4T-9231' }), item('Filter kit'), item('Tank')];
    const after = [item('Main pump', { serial_number: '4T-9455' }), item('Temp sensor', { serial_number: '88-2041' }), item('Tank')];

    const diff = diffSnapshotItems(before, after);

    expect(diff.rows).toEqual([
      { kind: 'changed', componentName: 'Main pump', before: 'S/N 4T-9231', after: 'S/N 4T-9455' },
      { kind: 'added', componentName: 'Temp sensor', before: null, after: 'S/N 88-2041' },
      { kind: 'removed', componentName: 'Filter kit', before: 'Fitted', after: null },
    ]);
    expect(diff.unchanged).toEqual([{ componentName: 'Tank', value: 'Fitted' }]);
  });

  it('matches components by system as well as name', () => {
    const diff = diffSnapshotItems([item('Seal')], [item('Seal', { system_name: 'Brakes' })]);

    expect(diff.rows.map((row) => row.kind)).toEqual(['added', 'removed']);
  });
});
