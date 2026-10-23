# machineAssignments

## Purpose

Technicians assigned to a machine (`/machines/:machineId/technicians`). Anyone who can see the machine (`machine.view`) sees who is assigned; `machine.manage` assigns and unassigns. Assignments drive "my machines" in the app: `GET /machines?assignedToMe=true`, and `GET /me/knowledge/for-my-machines`, which uses a technician's assigned machines once they have any (the whole fleet otherwise). The machine detail (`GET /machines/:id`) lists them as `assignedTechnicians`.

## Folder structure

```
machineAssignments/
├── machineAssignments.controller.ts   ← GET / POST {userId} / DELETE /:userId
├── machineAssignments.service.ts      ← checks machine + person are in the caller's organisation; audited
├── machineAssignments.repository.ts   ← machine_assignments SQL (also used by the machine detail)
├── assignedTechnicianMapper.ts        ← row → { id, name, avatarUrl, assignedAt }
└── dto/
```

## How to run locally

Runs inside the API (`npm run start:dev`) after migration `0104`. Database test: `npm run test:db -- test/machineApp.db-spec.ts`.

## Key conventions

- Only people in the caller's own organisation can be assigned (400 otherwise); assigning someone already assigned changes nothing.
- POST returns the machine's technicians after the change; DELETE is 204, or 404 when the person wasn't assigned.
- Audited as `machine_assignment` create/delete. A deleted user's assignments go with them (`ON DELETE CASCADE`).

## Environment variables required

None beyond the API's own (`DATABASE_URL`).
