import type { MachineDetailService } from "@/lib/types/machineDetailService";
import { toRangeStart } from "@/lib/machineDetail/historyDateRange";
import { requireAccessToken } from "../requireAccessToken";
import { ApiError } from "../httpClient";
import { updateMachineStatusRequest } from "../machineFleetApi";
import {
  createHistoryEntryRequest,
  deleteMachinePhotoRequest,
  getMachineRequest,
  listHistoryAuthorsRequest,
  listMachineHistoryRequest,
  uploadMachinePhotoRequest,
} from "../machineHistoryApi";
import {
  exportSnapshotDiffRequest,
  getSnapshotDiffRequest,
  listComponentsRequest,
  listGalleryPhotosRequest,
  listSnapshotsRequest,
  listSystemsRequest,
  takeSnapshotRequest,
  updateSnapshotRequest,
  uploadGalleryPhotoRequest,
} from "../machineConfigurationApi";
import { toCreateHistoryRequest, toGalleryPhoto, toHistoryEntry, toMachine } from "./machineDetailMapping";

// A list the backend can't serve (an older backend without the endpoint
// answers 404) is shown as empty, with the screen's next step, rather
// than as an error. The machine itself is checked by getMachine.
const emptyWhenMissing = async <T>(request: Promise<T[]>): Promise<T[]> => {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return [];
    throw error;
  }
};

// The machine detail screens' calls to the FIELD API.
export const machineDetailService: MachineDetailService = {
  getMachine: async (machineId) => toMachine(await getMachineRequest(requireAccessToken(), machineId)),

  updateStatus: async (machineId, status) =>
    (await updateMachineStatusRequest(requireAccessToken(), machineId, status)).status,

  listPhotos: async (machineId) =>
    (await emptyWhenMissing(listGalleryPhotosRequest(requireAccessToken(), machineId))).map(toGalleryPhoto),

  uploadPhoto: async (machineId, file) => toGalleryPhoto(await uploadGalleryPhotoRequest(requireAccessToken(), machineId, file)),

  listSystems: (machineId) => emptyWhenMissing(listSystemsRequest(requireAccessToken(), machineId)),

  listComponents: (machineId, systemId) =>
    emptyWhenMissing(listComponentsRequest(requireAccessToken(), machineId, systemId)),

  listSnapshots: (machineId) => emptyWhenMissing(listSnapshotsRequest(requireAccessToken(), machineId)),

  takeSnapshot: (machineId) => takeSnapshotRequest(requireAccessToken(), machineId),

  setSnapshotKnownGood: (machineId, snapshotId, isKnownGood) =>
    updateSnapshotRequest(requireAccessToken(), { machineId, snapshotId }, isKnownGood),

  getSnapshotDiff: (machineId, fromId, toId) => getSnapshotDiffRequest(requireAccessToken(), machineId, fromId, toId),

  exportSnapshotDiff: (machineId, fromId, toId, format) =>
    exportSnapshotDiffRequest(requireAccessToken(), { machineId, fromId, toId }, format),

  // One extra row tells whether there's another page.
  listHistory: async (machineId, query) => {
    const entries = await listMachineHistoryRequest(requireAccessToken(), machineId, {
      type: query.type || undefined,
      from: toRangeStart(query.range) ?? undefined,
      author: query.authorId || undefined,
      limit: query.limit + 1,
      offset: query.offset,
    });
    return { items: entries.slice(0, query.limit).map(toHistoryEntry), hasMore: entries.length > query.limit };
  },

  listHistoryAuthors: (machineId) => emptyWhenMissing(listHistoryAuthorsRequest(requireAccessToken(), machineId)),

  // Photos go up together once the entry exists; one that fails is left
  // off (the caller compares counts and says so).
  createHistoryEntry: async (machineId, entry) => {
    const accessToken = requireAccessToken();
    const created = await createHistoryEntryRequest(accessToken, machineId, toCreateHistoryRequest(entry));
    const target = { machineId, entryId: created.id };
    const uploads = await Promise.allSettled(entry.photos.map((file) => uploadMachinePhotoRequest(accessToken, target, file)));
    const photos = uploads.flatMap((upload) => (upload.status === "fulfilled" ? [upload.value.photo] : []));
    return toHistoryEntry({ ...created, photos: [...created.photos, ...photos] });
  },

  deleteHistoryPhoto: (machineId, entryId, photoId) =>
    deleteMachinePhotoRequest(requireAccessToken(), { machineId, entryId, photoId }),
};
