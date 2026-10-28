import { toMachineComponent } from './machineConfigurationMapper';
import { ComponentRow } from './types/machineConfigurationRows';

const baseRow: ComponentRow = {
  id: 'c-1',
  system_id: 's-1',
  system_name: 'Powertrain',
  name: 'Torque converter',
  serial_number: 'TC-88',
  firmware_version: null,
  part_number: null,
  manufacturer: null,
  condition_note: null,
  condition_severity: null,
  installed_at: null,
  hours_at_install: null,
  next_service_due_hours: null,
  notes: null,
  machine_operating_hours: null,
  last_entry_type: null,
  last_entry_at: null,
  last_serviced_at: null,
};

describe('toMachineComponent', () => {
  it('leaves unrecorded details null', () => {
    const component = toMachineComponent(baseRow);
    expect(component.serialNumber).toBe('TC-88');
    expect(component.conditionSeverity).toBeNull();
    expect(component.hoursSinceInstall).toBeNull();
    expect(component.installedAt).toBeNull();
  });

  it('works out hours since install from the machine hour meter', () => {
    const component = toMachineComponent({ ...baseRow, machine_operating_hours: 5200, hours_at_install: 4100 });
    expect(component.hoursSinceInstall).toBe(1100);
  });

  it('derives severity from the latest entry unless one is set', () => {
    const faulted = { ...baseRow, last_entry_type: 'fault', last_entry_at: new Date('2026-10-01T00:00:00Z') };
    expect(toMachineComponent(faulted).conditionSeverity).toBe('critical');
    expect(toMachineComponent({ ...faulted, condition_severity: 'warning' }).conditionSeverity).toBe('warning');
  });

  it('returns dates as ISO strings', () => {
    const component = toMachineComponent({
      ...baseRow,
      installed_at: new Date('2025-03-04T00:00:00Z'),
      last_serviced_at: new Date('2026-09-10T02:30:00Z'),
    });
    expect(component.installedAt).toBe('2025-03-04T00:00:00.000Z');
    expect(component.lastServicedAt).toBe('2026-09-10T02:30:00.000Z');
  });
});
