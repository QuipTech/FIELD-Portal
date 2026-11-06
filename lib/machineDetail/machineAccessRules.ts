import type { MachineSharing } from "../types/machineGroup";

type AccessFields = Pick<MachineSharing, "isShared" | "accessLevel">;

export const NO_LONGER_ACCESSIBLE_MESSAGE = "You no longer have access to this machine.";

// What the machine detail screens offer, from the machine's own access
// fields. The API enforces the same rules; these only hide what would fail.
// Unknown (still loading) offers nothing.

// Add history, Add photo, New case: own machines and "contribute" shares.
export const canContributeTo = (machine: AccessFields | null): boolean =>
  machine !== null && machine.accessLevel !== "view";

// Edit, status, lifecycle, technicians, sharing: own organisation only.
export const isOwnMachine = (machine: AccessFields | null): boolean => machine !== null && !machine.isShared;
