import { formatFieldId, normaliseFieldId } from "./machineAppConnection";

export interface McDevice {
  id: string;
  machine: { id: string; label: string; manufacturer: string; model: string; site: string | null };
  serialNumber: string | null;
  platform: string | null;
  appVersion: string | null;
  pairedAt: string;
  online: boolean;
  // When the tablet last talked to FIELD; null until it first does.
  lastSeenAt: string | null;
  fieldId?: string | null;
}

export interface McDeviceList {
  items: McDevice[];
  // Active machines the person could connect a tablet to, connected or not.
  connectableMachineCount: number;
}

export interface McDeviceSummary {
  connected: number;
  online: number;
  // Active machines without a tablet yet.
  notConnected: number;
}

export const summariseDevices = (list: McDeviceList): McDeviceSummary => ({
  connected: list.items.length,
  online: list.items.filter((device) => device.online).length,
  notConnected: Math.max(0, list.connectableMachineCount - list.items.length),
});

// "Android · TAB-001 · v1.2.0", leaving out what the tablet didn't send.
export const describeTablet = (device: McDevice): string =>
  [device.fieldId && `ID ${formatFieldId(device.fieldId)}`, device.platform && device.platform[0].toUpperCase() + device.platform.slice(1), device.serialNumber, device.appVersion && `v${device.appVersion}`]
    .filter(Boolean)
    .join(" · ") || "Tablet details not sent yet";

export const matchesDeviceSearch = (device: McDevice, search: string): boolean => {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  if (device.fieldId && /^[\d\s-]+$/.test(query) && device.fieldId.includes(normaliseFieldId(query))) return true;
  return [device.machine.label, device.machine.manufacturer, device.machine.model, device.machine.site, device.serialNumber]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(query));
};
