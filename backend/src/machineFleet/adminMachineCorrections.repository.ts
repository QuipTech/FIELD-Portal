import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
const BLANK_SERIAL_MESSAGE = "The serial number can't be blank.";
// Postgres error codes raised by admin_correct_machine().
const NOT_PLATFORM_ADMIN = '42501';
const INVALID_VALUE = '22023';

export interface AdminCorrectableFields {
  serialNumber: string;
  assetNumber: string | null;
  site: string | null;
}

export interface AdminCorrection {
  // The owning organisation, which gets the audit entry too.
  tenantId: string;
  before: AdminCorrectableFields;
  after: AdminCorrectableFields;
  fleetNumber: string | null;
  registrationNumber: string | null;
}

// The platform administrator's edit of another organisation's machine
// (migration 0127): only the keys present change. Anyone else gets the same
// 404 as before, so a shared machine's owner isn't given away.
export const correctMachineAsPlatformAdmin = async (
  client: PoolClient,
  machineId: string,
  changes: Partial<AdminCorrectableFields>,
): Promise<AdminCorrection> => {
  try {
    const result = await client.query<{ correction: AdminCorrection | null }>(
      `SELECT admin_correct_machine($1, $2::jsonb) AS correction`,
      [machineId, JSON.stringify(changes)],
    );
    const correction = result.rows[0]?.correction;
    if (!correction) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
    return correction;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === NOT_PLATFORM_ADMIN) {
      throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
    }
    if (code === INVALID_VALUE)
      throw new BadRequestException(BLANK_SERIAL_MESSAGE);
    throw error;
  }
};
