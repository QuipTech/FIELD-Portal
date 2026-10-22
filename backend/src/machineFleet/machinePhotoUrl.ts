import { StorageService } from '../storage/storage.service';
import { FleetMachine } from './types/machineFleetResponse';
import { FleetMachineRow } from './types/machineFleetRows';
import { toFleetMachine } from './machineFleetMapper';

// A fresh 15-minute URL for a machine's photo key (MACHINE_PHOTO_KEY_SQL);
// null without a photo.
export const signMachinePhoto = async (
  storageService: StorageService,
  storageKey: string | null,
): Promise<string | null> =>
  storageKey
    ? (await storageService.getSignedDownloadUrl(storageKey)).url
    : null;

// toFleetMachine with its photo signed.
export const toFleetMachineWithPhoto = async (
  storageService: StorageService,
  row: FleetMachineRow,
  canManageLifecycle = false,
): Promise<FleetMachine> => ({
  ...toFleetMachine(row, canManageLifecycle),
  photoUrl: await signMachinePhoto(storageService, row.photo_storage_key),
});
