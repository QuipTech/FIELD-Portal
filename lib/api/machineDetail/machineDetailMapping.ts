import type { HistoryEntry, NewHistoryEntry } from "@/lib/types/historyEntry";
import type { Machine, MachineGalleryPhoto } from "@/lib/types/machine";
import type { OperatingStatus } from "@/lib/types/machineFleet";
import type { GalleryPhotoResponse, LiveHistoryEntry, MachineDetailResponse } from "@/lib/types/machineHistory";
import type { NewHistoryEntryRequest } from "../machineHistoryApi";

const OPERATING_STATUSES: OperatingStatus[] = ["running", "down", "service_due"];
const DELETED_AUTHOR = { id: "deleted-user", name: "Deleted user" };

export const toMachine = (response: MachineDetailResponse): Machine => ({
  id: response.id,
  assetId: response.label,
  manufacturer: response.manufacturer,
  model: response.model,
  serialNumber: response.serialNumber,
  status: OPERATING_STATUSES.find((status) => status === response.status) ?? "running",
  operatingHours: response.operatingHours,
  hoursReadAt: response.hoursReadAt,
  site: response.site,
  owner: response.owner,
  openCaseCount: response.openCaseCount,
});

export const toGalleryPhoto = (photo: GalleryPhotoResponse): MachineGalleryPhoto => ({
  id: photo.id,
  caption: photo.caption ?? "Photo",
  contentType: photo.contentType,
  url: photo.signedUrl,
});

// The backend stores one description; its first line is the title.
export const toHistoryEntry = (entry: LiveHistoryEntry): HistoryEntry => {
  const [title, ...rest] = entry.description.split("\n");
  return {
    id: entry.id,
    type: entry.entryType,
    occurredAt: entry.createdAt,
    author: entry.author ?? DELETED_AUTHOR,
    title,
    description: rest.join("\n").trim(),
    component: entry.component,
    operatingHours: entry.operatingHours,
    downtimeHours: entry.downtimeHours,
    photos: entry.photos.map((photo) => ({
      id: photo.id,
      fileName: photo.fileName,
      contentType: photo.contentType,
      url: photo.signedUrl,
    })),
    syncState: "synced",
  };
};

export const toCreateHistoryRequest = (entry: NewHistoryEntry): NewHistoryEntryRequest => ({
  entryType: entry.type,
  description: entry.description,
  componentId: entry.componentId ?? undefined,
  componentReplaced: entry.componentReplaced || undefined,
  operatingHours: entry.operatingHours ?? undefined,
  downtimeHours: entry.downtimeHours ?? undefined,
});
