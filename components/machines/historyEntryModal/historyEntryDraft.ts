import type { HistoryEntryType, NewHistoryEntry } from "@/lib/types/historyEntry";
import type { SearchSelectOption } from "@/components/ui/searchSelect";

// The form as typed; numbers stay strings until they're validated.
export interface HistoryEntryDraft {
  type: HistoryEntryType | null;
  componentId: string;
  componentReplaced: boolean;
  description: string;
  photos: File[];
  hours: string;
  downtime: string;
}

export type HistoryEntryErrors = Partial<Record<"type" | "description" | "photos" | "hours" | "downtime", string>>;

export const DESCRIPTION_MAX_LENGTH = 5000;
export const MAX_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_ACCEPT = ".jpg,.jpeg,.png,.heic";
const MAX_DOWNTIME_HOURS = 10_000;

const parseHours = (value: string): number | null => (value.trim() ? Number(value.replace(/,/g, "")) : null);

const isValidHours = (value: number | null, max = Number.MAX_SAFE_INTEGER) =>
  value === null || (Number.isFinite(value) && value >= 0 && value <= max);

export const validateHistoryEntryDraft = (draft: HistoryEntryDraft): HistoryEntryErrors => {
  const errors: HistoryEntryErrors = {};
  if (!draft.type) errors.type = "Choose an entry type.";
  if (!draft.description.trim()) errors.description = "Describe what happened.";
  else if (draft.description.length > DESCRIPTION_MAX_LENGTH) errors.description = `Keep it under ${DESCRIPTION_MAX_LENGTH} characters.`;
  if (draft.photos.some((photo) => photo.size > MAX_PHOTO_BYTES)) errors.photos = "Each photo must be 10 MB or smaller.";
  if (!isValidHours(parseHours(draft.hours))) errors.hours = "Enter the hour meter reading as a number.";
  if (!isValidHours(parseHours(draft.downtime), MAX_DOWNTIME_HOURS)) errors.downtime = "Enter downtime in hours, e.g. 3.5.";
  return errors;
};

// Only called once the draft validates.
export const toNewHistoryEntry = (draft: HistoryEntryDraft, componentOptions: SearchSelectOption[]): NewHistoryEntry => {
  const component = componentOptions.find((option) => option.value === draft.componentId);
  return {
    type: draft.type as HistoryEntryType,
    componentId: component?.value ?? null,
    componentLabel: component ? `${component.group} › ${component.label}` : null,
    componentReplaced: draft.type === "repair" && Boolean(component) && draft.componentReplaced,
    description: draft.description.trim(),
    photos: draft.photos,
    operatingHours: parseHours(draft.hours),
    downtimeHours: parseHours(draft.downtime),
  };
};
