# machineSharing

## Purpose

Global machine groups, managed by the platform administrator (the Owner role, `platform.manage`). A group can hold machines from **any** organisation and be assigned to whole organisations or to individual people, at `view` or `contribute`. That deliberately allows controlled cross-organisation access, so the rule lives in the database and RLS enforces it:

- Each person is **`all`** (default: their own organisation's machines plus shared ones) or **`groups_only`** (only machines in groups assigned to them or their organisation). Organisation admins are always `all`.
- **`view`** reads a shared machine: list, search, detail, history, configuration, photos, manuals, dashboard and AI context. **`contribute`** also adds history entries, photos and support cases. Those rows belong to the machine's **owning** organisation, with `created_by` the contributor.
- A shared machine is **never** editable by the person it's shared with: not the record, status, lifecycle (activate, archive, transfer) or technicians. They never see the owner's billing or people either. Owners' names show as the organisation's name.
- Cases on a shared machine are visible to the reader only when **their own** organisation raised them.
- Anything outside someone's scope is **404**. Access is read on every request, so revoking applies on the next one.
- Knowledge brand access stays with the person's own organisation.
- The owning organisation's admins see who each of their machines is shared with, and can **withdraw one machine** from one assignment, with a reason. The rest of the group is untouched, and platform administrators are notified.

## Folder structure

```
machineSharing/
├── access/          ← the scope every machine read uses: machineScope.ts (SQL fragments over
│                      accessible_machines()), machineAccess.ts (requireMachineAccess: level + owning org),
│                      who may receive messages about a machine
├── groups/          ← /admin/machine-groups and /admin/machines/search (platform administrator)
├── shares/          ← /machines/:machineId/shares (owning organisation's admins)
├── userAccess/      ← people's machine access mode and accessible groups (/auth/me, /admin/users, /team)
├── dto/, types/
└── machineSharing.module.ts
```

The database side is migrations `0115`–`0119` (see `db/migrations/README.md`).

## How to run locally

```bash
npm run start:dev                 # the API
npm run test:machine-sharing      # cross-organisation security suite (PGlite, every migration, RLS on)
```

## Key conventions

- **Every machine read goes through the scope**: `visibleMachineSql` / `ownMachineSql` / `linkedMachineVisibleSql` (machineScope.ts) or `requireMachineAccess` / `assertMachineAccessible`. Never filter machines on `tenant_id` alone.
- The scope needs `app.user_id`, so reads run under `DatabaseService.withActor`. Without a user (background jobs) nothing is shared, and the organisation sees its own machines as before. Use `ALL_MACHINES` only on staff and job paths that already act for one organisation.
- Rows about a machine are read and written with the **owning** organisation's id (`access.tenantId`), not the caller's.
- Changes only the owner may make use `need: 'manage'` (404 on a shared machine). Adding history, photos and cases uses `'contribute'` (403 on a view-only share).
- Platform administrator reads across organisations go through the `admin_*` SECURITY DEFINER functions, which check `is_platform_admin()`. Nothing bypasses RLS.
- Audit: every group change is logged for the platform administrator, and in each owning organisation's log (`auditForMachineOwners`). A contributor's own actions are logged in their own organisation.

## Environment variables required

None beyond the API's own (`DATABASE_URL`, …).

## API

Errors use the API's usual body `{ statusCode, message }`. All routes need `Authorization: Bearer …`.

### Types

```ts
type MachineAccessMode = 'all' | 'groups_only';
type ShareAccessLevel = 'view' | 'contribute';
type MachineAccessLevel = 'owner' | ShareAccessLevel;

interface MachineGroupRef { id: string; name: string; colour: string | null }
interface AccessibleGroup extends MachineGroupRef { accessLevel: ShareAccessLevel }

interface MachineGroup extends MachineGroupRef {
  description: string | null;
  machineCount: number;        // live machines, any organisation
  organisationCount: number;   // active organisation assignments
  userCount: number;           // active person assignments
  createdAt: string; updatedAt: string;
}

interface GroupMachine {
  id: string; label: string;   // Plant ID, else fleet number, else serial
  serialNumber: string; model: string; manufacturer: string;
  status: string; lifecycleState: string;
  owningOrganisation: { id: string; name: string };
  addedAt: string;
}

interface GroupAssignment {
  id: string; targetType: 'organisation' | 'user'; targetId: string;
  targetName: string; targetEmail: string | null;
  organisation: { id: string; name: string };   // the organisation, or the person's
  accessLevel: ShareAccessLevel; grantedByName: string | null; grantedAt: string;
}

interface MachineShare {
  assignmentId: string; group: MachineGroupRef;
  targetType: 'organisation' | 'user'; targetName: string; organisationName: string;
  accessLevel: ShareAccessLevel; grantedAt: string;
  withdrawnAt: string | null; withdrawnReason: string | null;   // set once the owner withdrew this machine
}

interface MachineAccess {
  machineAccessMode: MachineAccessMode;   // stored
  effectiveMode: MachineAccessMode;       // always 'all' for organisation admins
  groups: AccessibleGroup[];              // assigned to them or their organisation
}
```

### Platform administrator (`platform.manage`, AdminScopeGuard + RLS)

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/admin/machine-groups` | – | `MachineGroup[]` |
| POST | `/admin/machine-groups` | `{ name, colour?, description? }` | `MachineGroup`; 409 if the name is taken (ignoring case) |
| GET | `/admin/machine-groups/:groupId` | – | `MachineGroup` |
| PATCH | `/admin/machine-groups/:groupId` | any of `{ name, colour, description }` | `MachineGroup` |
| DELETE | `/admin/machine-groups/:groupId` | – | 204; ends every assignment (reason "Group deleted") |
| GET | `/admin/machine-groups/:groupId/activity` | – | `{ id, action, metadata, actorName, createdAt }[]`, newest first |
| GET | `/admin/machine-groups/:groupId/machines` | – | `GroupMachine[]` |
| POST | `/admin/machine-groups/:groupId/machines` | `{ machineIds: string[] }` (≤ 500) | `GroupMachine[]`; 404 if any id is unknown (nothing added) |
| DELETE | `/admin/machine-groups/:groupId/machines/:machineId` | – | 204; 404 if not in the group |
| GET | `/admin/machine-groups/:groupId/assignments` | – | `GroupAssignment[]` (active) |
| POST | `/admin/machine-groups/:groupId/assignments` | `{ targetType, targetId, accessLevel }` | `GroupAssignment[]`; an existing target gets the new level; 400 unknown target |
| DELETE | `/admin/machine-groups/:groupId/assignments/:assignmentId` | `{ reason }` (3–500 chars) | 204 |
| GET | `/admin/machines/search` | `?search=&limit=` (≤ 100, default 25): plant ID, fleet number, serial, VIN or organisation name | `(Omit<GroupMachine,'addedAt'> & { registrationNumber })[]` |
| GET | `/admin/machines/:machineId/groups` | – | `{ id, name }[]`, the machine's live groups; 404 unknown machine |
| PUT | `/admin/machines/:machineId/groups` | `{ groupIds: string[] }` (≤ 200; empty leaves all) | `{ id, name }[]`; one transaction, audited per changed group; 404 if the machine or an added group is unknown (nothing changes) |
| POST | `/admin/machines/move-to-group` | `{ machineIds: string[] (1–500), groupId }` | `{ moved, group: { id, name } }`; each machine leaves all its groups and joins `groupId`, one transaction, audited like PUT above; `moved` counts machines that changed; 404 if a machine or the group is unknown (nothing moves). "Move to group" on the Machines list |
| GET | `/admin/users/:userId/machine-access` | – | `MachineAccess` (changed) |
| PATCH | `/admin/users/:userId/machine-access` | `{ machineAccessMode, organisationId? }` (the person's organisation) | `MachineAccess`; 400 `groups_only` for an admin (changed: no `groupIds`) |

### Owning organisation's admins (`admin.manage_users`)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/machines/:machineId/shares` | – | `MachineShare[]`; 404 unless the caller's organisation owns the machine |
| DELETE | `/machines/:machineId/shares/:assignmentId` | `{ reason }` | `MachineShare[]` (now); 409 if already withdrawn. Audited in their log; platform administrators get a `machine_sharing` notification |

### Everyone (changed)

- **`GET /auth/me`**: `machineAccessMode: 'all' | 'groups_only'` and `accessibleGroups: AccessibleGroup[]`.
- **`GET /machines`**: own organisation's machines in scope plus shared ones. New query parameters `groupId` (one of `accessibleGroups`) and `source=own|shared`; `ungrouped` is gone. Each item has `groups: MachineGroupRef[]`, `owningOrganisationName`, `isShared` and `accessLevel` (`owner` / `view` / `contribute`); `groupId` / `groupName` / `groupColour` are gone. A shared machine's `availableActions` is always `[]` and `canRequestTransfer` false.
- **`GET /machines/:machineId`** (detail): the same four fields replace `group`. On a shared machine `owner` is null and `assignedTechnicians` is `[]`.
- **History entries** gain `authorOrganisationName`: set instead of `author` when the author is in another organisation.
- **`GET /cases/options`**: machines the caller may raise a case about (own, and `contribute` shares), each with `sharedByOrganisationName`.
- **`POST /cases`** with a shared machine's `machineId`: needs `contribute` (403 for `view`), and the case belongs to the owning organisation.
- **Writes on a shared machine**: `PATCH /machines/:id`, `PATCH …/status`, `PATCH …/identifiers`, lifecycle, transfers, technicians, snapshots taken/restored, and deleting history photos are 404. `POST …/history` and `POST …/photos` (gallery and history entries) need `contribute`.
- **`POST /machines`**, `POST /machines/import`: no group (`groupId` and the CSV `group` column are gone).
- **`/team`**: `GET /team/:userId/machine-access` is read-only; PATCH is gone. Invitations (`/team/invitations`, `/admin/users/invitations`) take `machineAccessMode` (`all` / `groups_only`), with no `groupIds`.

### Removed

`/machine-groups*`, `POST /machines/bulk-assign-group`, `PATCH /team/:userId/machine-access`, and `/admin/organisations/:id/machine-groups|machines*`.
