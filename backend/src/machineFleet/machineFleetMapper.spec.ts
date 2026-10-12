import {
  groupCatalogByMake,
  toFeaturedDownMachine,
  toFleetMachine,
} from './machineFleetMapper';
import { FeaturedDownRow, FleetMachineRow } from './types/machineFleetRows';

const machineRow = (
  overrides: Partial<FleetMachineRow> = {},
): FleetMachineRow => ({
  id: 'machine-1',
  label: 'HT-2201',
  serial_number: 'CAT0793FXYZ',
  manufacturer_name: 'CAT',
  model_name: '793F',
  product_family: 'Haul truck',
  site: 'Pit 4',
  operating_hours: 14208,
  status: 'down',
  ...overrides,
});

describe('toFleetMachine', () => {
  it('maps the columns the list shows', () => {
    expect(toFleetMachine(machineRow())).toEqual({
      id: 'machine-1',
      label: 'HT-2201',
      serialNumber: 'CAT0793FXYZ',
      manufacturer: 'CAT',
      model: '793F',
      machineClass: 'Haul truck',
      site: 'Pit 4',
      operatingHours: 14208,
      status: 'down',
    });
  });

  it('reads an unknown status as running and a blank class as none', () => {
    const result = toFleetMachine(
      machineRow({ status: 'active', product_family: '' }),
    );
    expect(result.status).toBe('running');
    expect(result.machineClass).toBeNull();
  });
});

describe('toFeaturedDownMachine', () => {
  const featuredRow = (
    overrides: Partial<FeaturedDownRow> = {},
  ): FeaturedDownRow => ({
    ...machineRow(),
    case_number: '1042',
    case_subject: 'Brake pressure alarm',
    case_priority: 'P1',
    ...overrides,
  });

  it('includes the open case', () => {
    expect(toFeaturedDownMachine(featuredRow()).openCase).toEqual({
      caseNumber: 1042,
      subject: 'Brake pressure alarm',
      priority: 'P1',
    });
  });

  it('has no case when none is open', () => {
    const result = toFeaturedDownMachine(
      featuredRow({
        case_number: null,
        case_subject: null,
        case_priority: null,
      }),
    );
    expect(result.openCase).toBeNull();
  });
});

describe('groupCatalogByMake', () => {
  it('groups models under their make, keeping order', () => {
    const result = groupCatalogByMake([
      {
        manufacturer_id: 'cat',
        manufacturer_name: 'CAT',
        model_id: 'm1',
        model_name: '777G',
        product_family: 'Haul truck',
      },
      {
        manufacturer_id: 'cat',
        manufacturer_name: 'CAT',
        model_id: 'm2',
        model_name: '793F',
        product_family: null,
      },
      {
        manufacturer_id: 'kom',
        manufacturer_name: 'Komatsu',
        model_id: 'm3',
        model_name: 'WA900',
        product_family: 'Wheel loader',
      },
    ]);
    expect(result.map((make) => make.name)).toEqual(['CAT', 'Komatsu']);
    expect(result[0].models.map((model) => model.name)).toEqual([
      '777G',
      '793F',
    ]);
    expect(result[0].models[1].machineClass).toBeNull();
  });
});
