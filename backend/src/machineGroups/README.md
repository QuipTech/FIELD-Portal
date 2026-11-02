# machineGroups

## Purpose

An organisation groups its machines by customer (e.g. "ABC Earthmoving", 30 machines) and limits people to selected groups. A machine is in at most one group, or ungrouped. Each person is either:

- **`all`** (the default): every machine in the organisation, or
- **`selected`**: only machines in their groups. Ungrouped machines and other groups' machines are hidden everywhere: the Machines list and search, machine detail, history, configuration snapshots, photos, manuals, support cases about those machines, dashboard figures, machine alerts in the bell, and the AI assistant's machine context.

Organisation admins (`admin.manage_users`) and the platform administrator (`platform.manage`) always see every machine, whatever is stored for them.

A machine outside someone's scope is **404, never 403**, exactly as if it didn't exist. Access is read on every request, so a group taken away applies on the person's next request (no sign-out needed).

## API

All routes need a signed-in user (`Authorization: Bearer …`). Errors use the API's usual body: `{ statusCode, message }`, plus `code` where noted.

### Types

```ts
type MachineAccessMode = 'all' | 'selected';

interface MachineGroup {
  id: string;
  name: string;               // unique in the organisation, ignoring case
  colour: string | null;      // "#RRGGBB"
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  machineCount: number;       // live machines in the group
  userCount: number;          // 'selected' people who have this group ('all' people aren't counted)
  createdAt: string;          // ISO 8601
  updatedAt: string;
}

interface MachineGroupRef { id: string; name: string; colour: string | null }

interface MachineAccess {
  machineAccessMode: MachineAccessMode; // what is stored
  effectiveMode: MachineAccessMode;     // what applies: always 'all' for admins
  groups: MachineGroupRef[];            // [] unless effectiveMode is 'selected'
}
```

### Machine groups (organisation admins only: `admin.manage_users`)

| Method | Path | Body / query | Returns |
| --- | --- | --- | --- |
| GET | `/machine-groups` | – | `MachineGroup[]`, sorted by name |
| GET | `/machine-groups/:groupId` | – | `MachineGroup & { users: { id, name, email, status }[] }`: the people counted in `userCount`. Its machines: `GET /machines?groupId=` |
| POST | `/machine-groups` | `{ name, colour?, contactName?, contactEmail?, contactPhone?, notes? }` | `MachineGroup` (201) |
| PATCH | `/machine-groups/:groupId` | any of the POST fields; `null` clears an optional field; `name` can't be cleared | `MachineGroup` |
| DELETE | `/machine-groups/:groupId` | `?force=true` | 204 |

- A name already used by a live group (ignoring case) is **409**. A deleted group's name can be reused.
- `colour` must be `#RRGGBB` (400 otherwise).
- **Delete**: soft delete. Its machines become ungrouped, and every person's access to it is removed. Someone whose only group it was stays `selected` and sees no machines until an admin gives them a group or all machines. If the group still has machines and `force` isn't `true`, the API answers **409** without changing anything:

  ```json
  { "statusCode": 409, "code": "group_has_machines", "machineCount": 30, "userCount": 4,
    "message": "Its 30 machines will become Ungrouped. Send force=true to delete it anyway." }
  ```

  Show the confirmation ("Its 30 machines will become Ungrouped. Users who only had access to this group will lose access to them."), then repeat with `?force=true`.
- Another organisation's group is 404.

### Putting machines in groups

| Method | Path | Body | Who | Returns |
| --- | --- | --- | --- | --- |
| POST | `/machines/bulk-assign-group` | `{ machineIds: string[] (1–500), groupId: string \| null }` | organisation admins | `{ moved, unchanged }` |
| PATCH | `/machines/:machineId` | `{ groupId: string \| null, …other fields }` | `machine.manage`, plus `admin.manage_users` when `groupId` is sent (403 otherwise) | the machine (`FleetMachine`) |
| POST | `/machines` | `{ …, groupId? }` | `machine.create` (see below) | the machine (201) |

- `groupId: null` takes machines out of their group (Ungrouped). `groupId` is required in the bulk body.
- Bulk is all or nothing: an unknown or other organisation's machine id is 404 and nothing moves; an unknown group is 400.
- **Registering a machine** (`POST /machines`): organisation admins may pick any group or none. People on `selected` **must** pick one of their own groups (400 otherwise), because the machine would otherwise vanish for them as soon as it's saved. Everyone else can't set a group (403).

### Machines list and detail (changed)

- `GET /machines` accepts `?groupId=<id>` (one group's machines) and `?ungrouped=true` (machines in no group). Both combine with the existing filters and search. For someone on `selected`, `ungrouped=true` and other groups' ids return an empty list.
- Every machine in the list (and the `featuredDown` machine) now has `groupId`, `groupName` and `groupColour` (all `null` when ungrouped).
- `GET /machines/:machineId` (detail) now has `group: { id, name, colour } | null`.
- The list's `facets` (sites, makes, classes) only cover machines the caller can see.

### Fleet CSV import (new)

The portal reads the CSV and maps its columns; the API takes the mapped rows as JSON.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/machines/import/template` | – | the sample CSV file (`text/csv`), including the optional `group` column |
| POST | `/machines/import` | `{ rows: ImportedMachine[] (1–1000), dryRun?: boolean }` | `FleetImportResult` (200) |

Same permission (`machine.create`) and plan feature as registering one machine.

```ts
interface ImportedMachine {      // every cell is a string; blank = not given
  serialNumber: string;          // required, unique in the organisation and in the file
  make: string;                  // required, as named in the Machine library (ignoring case)
  model: string;                 // required, likewise
  plantId?: string;
  site?: string;
  operatingHours?: string;       // whole hours, "12,450" is fine
  status?: string;               // running | down | service due (default running)
  group?: string;                // a machine group's name, ignoring case
}

interface FleetImportResult {
  dryRun: boolean;
  imported: number;              // 0 for a dry run
  newGroups: string[];           // groups the import creates (or created)
  rows: {
    row: number;                 // 1-based data row
    serialNumber: string | null;
    errors: string[];            // [] when the row can be imported
    group: { name: string; isNew: boolean } | null;
  }[];
}
```

- `dryRun: true` checks every row and saves nothing. Use it for the preview step.
- Without `dryRun`: if any row has an error, nothing is saved and the API answers **400** with `code: "import_has_errors"` and the same `rows` (each with its `errors`). Otherwise every machine (and any new group) is saved in one transaction, and each is audited like a single registration.
- **The `group` column** is matched to an existing group by name (ignoring case). A name that doesn't exist yet is created when an organisation admin imports; for anyone else it's a row error. People on `selected` must give one of their own groups on every row, as with `POST /machines`.

### People's machine access

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/team/invitations` (and `/admin/users/invitations`) | existing fields plus `machineAccessMode?: 'all' \| 'selected'` (default `all`), `groupIds?: string[]` | `{ id }` (changed) |
| GET | `/team` | existing query | each user now has `machineAccess: MachineAccess` (changed) |
| GET | `/team/:userId/machine-access` | – | `MachineAccess` (new) |
| PATCH | `/team/:userId/machine-access` | `{ machineAccessMode, groupIds? }` | `MachineAccess` (new) |

All `/team` routes need `admin.manage_users`.

Validation (all **400**, checked before anything is saved and, for invitations, before any email is sent):

- `selected` needs at least one group; `groupIds` is ignored for `all`.
- Every group must be a live group of the same organisation.
- An organisation admin (a role with `admin.manage_users` or `platform.manage`) can't be set to `selected`. When inviting, the check uses the chosen role. In the portal, hide the "Machine access" section for admin roles and say they always see all machines.

An invited person's groups are saved with the invitation and apply from their first sign-in. A person outside the caller's organisation is 404.

### The signed-in user: `GET /auth/me` (changed)

```ts
machineAccessMode: 'all' | 'selected';   // what applies (always 'all' for admins)
accessibleGroups: MachineGroupRef[];     // their groups when 'selected', else []
```

When `machineAccessMode` is `selected`: hide group management and "Move to group", list only `accessibleGroups` in the group filter (no "Ungrouped"), and show e.g. "Showing machines for: ABC Earthmoving". The same applies in the mobile app.

### Other behaviour that follows the scope

- **Support cases**: people on `selected` see cases about their machines and cases about no machine; cases about other machines are left out of the list, counts and unread badge, and are 404 by number (REST and live chat). The New case form's machine list only offers their machines. QuipTech support staff are unaffected.
- **Dashboard** (`GET /dashboard`, and the down machines and near-breach cases on `GET /dashboard/admin`): every machine, case and history figure covers only machines the caller can see.
- **AI assistant**: asking about a machine outside the scope is 404, including in an existing thread whose machine has since left the scope. That thread's machine label is hidden in the thread list.
- **Alerts**: alerts about a machine, or about a support case on a machine, only go to people who can see that machine. Existing machine alerts outside the scope are hidden from the bell and its unread count.
- **Assigned technicians**: someone who can't see a machine's group can't be assigned to it (400).
- **Transfers**: a machine transferred to another organisation leaves its group behind (cleared by the database).

### Audit log

| Event | `entity_type` / `action` | Metadata |
| --- | --- | --- |
| Group created | `machine_group` / `create` | `name` |
| Group edited or renamed | `machine_group` / `update` | `name`, `renamed`, `before`, `after` (changed fields only) |
| Group deleted | `machine_group` / `delete` | `name`, `ungroupedMachineIds`, `removedUserIds` |
| Machine moved between groups | `machine` / `update` | `change: "group"`, `before`/`after: { groupId, groupName }`, one entry per machine |
| Machine access changed | `user` / `update` | `change: "machine_access"`, `before`/`after: { machineAccessMode, groups: [{ id, name }] }` |

Each entry records who (`user_id`) and when (`created_at`). The admin Audit log page labels them ("Renamed machine group", "Moved machine to group", "Changed machine access").

## Folder structure

```
machineGroups/
├── access/
│   ├── machineScope.ts                ← MachineScope type, resolveMachineScope, the SQL condition every machine query uses (pure, tested)
│   ├── getAccessibleMachineScope.ts   ← THE helper: the caller's scope, read per request
│   ├── machineVisibility.repository.ts← the reverse: which of these people can see a machine (assignments)
│   ├── keepPeopleWhoCanSeeMachine.ts  ← the same for a message about a machine or a case on one (alerts)
│   ├── machineAccessRules.ts          ← 'selected' needs a group, admins can't be limited (pure, tested)
│   └── newMachineGroupRule.ts         ← which group a new or imported machine may go in (pure, tested)
├── dto/                               ← group, access and bulk-assign request bodies
├── types/machineGroupTypes.ts         ← rows and responses
├── machineGroups.controller.ts        ← /machine-groups
├── machineGroupAssignment.controller.ts ← POST /machines/bulk-assign-group
├── machineGroups.service.ts           ← list, detail, create, edit, delete (audited)
├── machineAccess.service.ts           ← read and set people's access; invitation checks and saving
├── moveMachinesToGroup.ts             ← moves machines between groups, audited per machine
├── machineGroups.repository.ts / machineGroupMoves.repository.ts / machineAccess.repository.ts
└── machineGroupsMapper.ts
```

The fleet CSV import lives in `src/machineFleet/fleetImport/`.

## How to run locally

Part of the API (`npm run start:dev`); apply migrations `0113`–`0114` first. Tests:

- `npx jest src/machineGroups`: the rules
- `npm run test:machine-groups`: every migration on PGlite, as the `field_app` role with RLS. Covers what a `selected` person sees (list, search, detail, history, snapshots, cases, AI context, dashboard, bell), admins, deleting groups, moves, access changes, invitations, the import and cross-organisation isolation.

## Key conventions

- **Every machine read goes through `getAccessibleMachineScope`**: either directly, through `assertMachineAccessible` (machineHistory), or through a repository that takes a `MachineScope`. New machine queries must take a `MachineScope` argument too. Pass `ALL_MACHINES` only where access is already settled (staff paths, re-reading a row just written).
- Tables are tenant-scoped with RLS like the rest of the schema (`machine_groups`, `user_machine_group_access`). The per-person scope is enforced in the API, because RLS only knows the organisation.
- The foreign keys include `tenant_id`, so the database refuses a machine or person linked to another organisation's group.

## Environment variables required

None.
