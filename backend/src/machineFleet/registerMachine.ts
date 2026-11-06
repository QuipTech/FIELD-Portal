import { BadRequestException } from '@nestjs/common';
import { PoolClient } from 'pg';
import * as catalogRepository from './machineCatalog.repository';
import { OperatingStatus } from './types/machineFleetResponse';

export const UNKNOWN_MODEL_MESSAGE =
  'That model is not in the Machine library. Pick another, or ask your QuipTech admin to add it.';

export interface NewMachine {
  modelId: string;
  serialNumber: string;
  assetNumber: string | null;
  site: string | null;
  operatingHours: number | null;
  status: OperatingStatus;
}

// Saves one machine against a Machine library model, in the caller's
// transaction (POST /machines). A serial already registered in the
// organisation is a unique violation (23505). It belongs to the caller's
// organisation and is in no machine group; only the platform administrator
// shares machines.
export const registerMachine = async (
  client: PoolClient,
  registrar: { tenantId: string; userId: string },
  machine: NewMachine,
): Promise<string> => {
  const manufacturerId = await catalogRepository.findModelManufacturerId(
    client,
    { modelId: machine.modelId, tenantId: registrar.tenantId },
  );
  if (!manufacturerId) throw new BadRequestException(UNKNOWN_MODEL_MESSAGE);
  return catalogRepository.insertMachine(client, {
    ...machine,
    tenantId: registrar.tenantId,
    createdBy: registrar.userId,
    manufacturerId,
  });
};
