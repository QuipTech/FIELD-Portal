import {
  OPERATING_STATUSES,
  OperatingStatus,
} from '../types/machineFleetResponse';
import { ImportedMachineDto } from './dto/importFleetDto';

// The fleet CSV import's row checks, with no I/O (unit-tested). The
// service looks up models and serials and then applies these.

// The sample file the portal offers (GET /machines/import/template).
export const FLEET_IMPORT_TEMPLATE: string[][] = [
  [
    'serial_number',
    'make',
    'model',
    'plant_id',
    'site',
    'operating_hours',
    'status',
  ],
  [
    'CAT0793FXYZ01',
    'Caterpillar',
    '793F',
    'HT-2201',
    'North Pit',
    '12450',
    'running',
  ],
  [
    'KMT0830EABC02',
    'Komatsu',
    '830E-5',
    'HT-2202',
    'North Pit',
    '9800',
    'service due',
  ],
];

const MAX_HOURS = 1_000_000;

// "Service due", "service_due" and "SERVICE-DUE" all mean service_due;
// blank is running. null when it's none of them.
export const toImportStatus = (value?: string): OperatingStatus | null => {
  if (!value) return 'running';
  const status = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return (OPERATING_STATUSES as readonly string[]).includes(status)
    ? (status as OperatingStatus)
    : null;
};

// A whole number of hours, or null when blank; NaN when it isn't one.
export const toImportHours = (value?: string): number | null => {
  if (!value) return null;
  const hours = Number(value.replace(/,/g, ''));
  return Number.isInteger(hours) && hours >= 0 && hours <= MAX_HOURS
    ? hours
    : NaN;
};

export const toModelKey = (make: string, model: string) =>
  `${make.trim().toLowerCase()}|${model.trim().toLowerCase()}`;

export const toSerialKey = (serial: string) => serial.trim().toLowerCase();

export interface CheckedRow {
  serialNumber: string;
  modelKey: string;
  plantId: string | null;
  site: string | null;
  operatingHours: number | null;
  status: OperatingStatus;
}

// A row's own problems (missing or unreadable cells), and serials that
// appear more than once in the file. Lookups against the database come
// after.
export const checkRows = (
  rows: ImportedMachineDto[],
): { checked: (CheckedRow | null)[]; errors: string[][] } => {
  const seenSerials = new Map<string, number>();
  const errors: string[][] = rows.map(() => []);
  const checked = rows.map((row, index) => {
    const rowErrors = errors[index];
    if (!row.serialNumber) rowErrors.push('Serial number is missing.');
    if (!row.make || !row.model)
      rowErrors.push('Make and model are both needed.');
    const status = toImportStatus(row.status);
    if (!status)
      rowErrors.push(
        `Status "${row.status}" isn't running, down or service due.`,
      );
    const operatingHours = toImportHours(row.operatingHours);
    if (Number.isNaN(operatingHours)) {
      rowErrors.push(
        `Operating hours "${row.operatingHours}" isn't a whole number of hours.`,
      );
    }
    if (row.serialNumber) {
      const key = toSerialKey(row.serialNumber);
      const firstRow = seenSerials.get(key);
      if (firstRow !== undefined) {
        rowErrors.push(`Serial number is repeated from row ${firstRow + 1}.`);
      } else seenSerials.set(key, index);
    }
    if (rowErrors.length) return null;
    return {
      serialNumber: row.serialNumber!,
      modelKey: toModelKey(row.make!, row.model!),
      plantId: row.plantId ?? null,
      site: row.site ?? null,
      operatingHours,
      status: status!,
    };
  });
  return { checked, errors };
};
