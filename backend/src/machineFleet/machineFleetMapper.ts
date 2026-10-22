import {
  FeaturedDownMachine,
  FleetMachine,
  MachineCatalogMake,
  OPERATING_STATUSES,
  OperatingStatus,
} from './types/machineFleetResponse';
import {
  CatalogModelRow,
  FeaturedDownRow,
  FleetMachineRow,
} from './types/machineFleetRows';
import {
  canRequestTransfer,
  listAvailableActions,
  toLifecycleState,
} from '../machineLifecycle/lifecycleTransitions';

// The column's CHECK allows only these; anything else reads as running.
const toOperatingStatus = (status: string): OperatingStatus =>
  (OPERATING_STATUSES as readonly string[]).includes(status)
    ? (status as OperatingStatus)
    : 'running';

// canManageLifecycle: whether the caller holds machine.lifecycle.
export const toFleetMachine = (
  row: FleetMachineRow,
  canManageLifecycle = false,
): FleetMachine => {
  const lifecycleState = toLifecycleState(row.lifecycle_state);
  return {
    id: row.id,
    label: row.label,
    serialNumber: row.serial_number,
    manufacturer: row.manufacturer_name,
    model: row.model_name,
    machineClass: row.product_family || null,
    site: row.site,
    operatingHours: row.operating_hours,
    // Signed by the services (machinePhotoUrl.ts); mappers stay pure.
    photoUrl: null,
    status: toOperatingStatus(row.status),
    lifecycleState,
    availableActions: listAvailableActions(lifecycleState, canManageLifecycle),
    canRequestTransfer: canRequestTransfer(lifecycleState, canManageLifecycle),
  };
};

export const toFeaturedDownMachine = (
  row: FeaturedDownRow,
): FeaturedDownMachine => ({
  machine: toFleetMachine(row),
  openCase:
    row.case_number && row.case_subject && row.case_priority
      ? {
          caseNumber: Number(row.case_number),
          subject: row.case_subject,
          priority: row.case_priority,
        }
      : null,
});

// Rows arrive sorted by make then model, so each make's models stay sorted.
export const groupCatalogByMake = (
  rows: CatalogModelRow[],
): MachineCatalogMake[] => {
  const makes = new Map<string, MachineCatalogMake>();
  rows.forEach((row) => {
    const make = makes.get(row.manufacturer_id) ?? {
      id: row.manufacturer_id,
      name: row.manufacturer_name,
      models: [],
    };
    make.models.push({
      id: row.model_id,
      name: row.model_name,
      machineClass: row.product_family || null,
    });
    makes.set(row.manufacturer_id, make);
  });
  return Array.from(makes.values());
};
