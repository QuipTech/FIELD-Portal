import { MeCapabilities } from '../meCapabilities';
import { MachineAccessMode } from '../../machineSharing/access/machineScope';
import { AccessibleGroup } from '../../machineSharing/types/machineGroupTypes';

// GET /auth/me — the signed-in user, re-read on every call.
export interface MeResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  // active / invited / …
  status: string;
  phoneNumber: string | null;
  site: string | null;
  // BCP 47, e.g. "en-AU".
  language: string;
  // Role names, e.g. ["Field Technician"]. Defaults: Owner (QuipTech
  // platform admin), Technical Manager, Knowledge Manager, Field
  // Technician, Customer, Support Agent; organisations can add their own.
  roles: string[];
  permissions: string[];
  // Branch on these rather than role names.
  capabilities: MeCapabilities;
  // Which machines they see: 'all' (their organisation's, always for
  // organisation admins, plus shared groups) or 'groups_only' (only
  // machines in accessibleGroups). Read on every request: never filter on
  // the device for security, the API already does.
  machineAccessMode: MachineAccessMode;
  // Shared groups assigned to them or their organisation, with their level
  // (for the Group filter and chips).
  accessibleGroups: AccessibleGroup[];
  tenant: { id: string; name: string; slug: string };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    // Role names, e.g. ["Owner"] — the portal picks the admin or customer
    // dashboard from these after sign-in.
    roles: string[];
    // Permission codes granted by those roles, e.g. "ai.use"; the portal
    // disables actions the user lacks.
    permissions: string[];
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
}
