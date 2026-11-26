export interface MachineAppConnection {
  connected: boolean;
  session?: { status: "active" | "pending"; tabletOnline: boolean; portalOnline: boolean } | null;
  device: {
    id: string;
    serialNumber: string | null;
    platform: string | null;
    appVersion: string | null;
    pairedAt: string;
    online?: boolean;
    // Null or absent for a tablet paired with a code, which asks its operator.
    fieldId?: string | null;
  } | null;
}

export const TABLET_PASSWORD_MIN = 8;

// "482915307", from however it was typed or pasted.
export const normaliseFieldId = (value: string): string => value.replace(/[\s-]/g, "");

export const isFieldId = (value: string): boolean => /^\d{9}$/.test(normaliseFieldId(value));

// "482 915 307", easier to read across to a tablet.
export const formatFieldId = (fieldId: string): string => fieldId.replace(/(\d{3})(?=\d)/g, "$1 ");

export const machineAppPagePath = (machineId: string): string => `/machines/${machineId}/machine-app`;
