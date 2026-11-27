# Send file to tablet

A Portal user sends files to one machine's tablet, from the remote session
window or the machine's **Machine app** tab. Each send is an ordinary design
delivery (migration `0144`), so **the tablet needs no new endpoint**. Works for
FIELD ID and code-paired tablets, with or without an open session.

Read with the [tablet access contract](tablet-access-contract.md) and the
[design delivery handoff](tablet-file-transfer-contract.md).

## Please confirm first: earlier files in the folder

Every send is a new version of one project, **Remote session files**, and its
manifest lists **only that send's files**. The design delivery handoff says an
active project is exactly the new manifest, and paths absent from it are
removed. Followed as written, **sending `b.dxf` after `a.dxf` removes `a.dxf`
from Files**.

Please say what the Windows app does today with a path that is missing from the
new version:

- **Keeps it** (or you can make it keep it for this project): nothing changes.
- **Removes it:** tell us, and the Portal will use a separate project per send
  (for example `Remote session files 2026-11-27 14.05`). That is a Portal-only
  change.

A file sent again under the same name replaces the earlier one (your `.bak`
rule).

## Staging

| | |
| --- | --- |
| API | `https://staging-api.quiptechfield.com.au` (no `/api` prefix) |
| Portal | `https://staging.quiptechfield.com.au` |
| Deployed | **Not deployed yet.** Staging runs `4f8984b`, without this feature. The SHA and date will be sent after deployment (check with `GET /build`) |

The responses and samples below come from the code and its automated tests.
None has been checked on staging or on a Windows tablet.

**Test account:** not included here. It needs an organisation with Machine
Control on, a user who is Owner or Organisation Admin (`mc.deliver`,
`mc.manage_devices`, `mc.remote`; remote sessions in the plan to test during a
session), and an active machine with a tablet. Credentials are shared
separately.

## Portal routes

Portal sign-in (`Authorization: Bearer <access token>`) and Machine Control on.
The tablet does not call these.

| Call | Permission | Machine access | Success |
| --- | --- | --- | --- |
| `POST /machines/{machineId}/tablet-files` | `mc.deliver` | Own machine, or a `contribute` share | `201`, a send |
| `GET /machines/{machineId}/tablet-files` | `mc.view` | Any access | `200 { "sends": [ … ] }`, newest first, at most 20 |

`mc.deliver` belongs to Owner, Organisation Admin, Customer and Technical
Manager by default. `mc.remote` is not needed, and no open session is needed.
Both calls need an active machine.

### POST request

`multipart/form-data`:

| Part | Content |
| --- | --- |
| `sendId` | A UUID made by the caller, one per send |
| `names` | JSON array of file names, in the order of the `files` parts, up to 12,000 characters |
| `files` | One part per file |

Names are sent separately so non-ASCII names survive. The part's own file name
is ignored. Unknown fields are rejected with `400`.

Repeating a request with the same `sendId`, machine and files returns the first
send (`201`) and creates nothing.

### Send object

```json
{
  "id": "9c1b6c1e-1d0a-4f0e-9a43-1f2b9d7a5c10",
  "sendId": "6f1c0c1e-3b8f-4f7a-9d55-2a1f6c3b7e10",
  "status": "waiting",
  "error": null,
  "senderName": "Sam Support",
  "createdAt": "2026-11-27T04:05:00.000+00:00",
  "updatedAt": "2026-11-27T04:05:00.000+00:00",
  "files": [{ "name": "surface.dxf", "sizeBytes": 123456 }]
}
```

`id` is the `deliveryId` the tablet sees. `senderName` is the organisation's
name when the sender is in another organisation than the reader.

| `status` | Portal label | From |
| --- | --- | --- |
| `waiting` | Waiting | Created; no PATCH yet |
| `downloading` | Downloading | Tablet PATCH |
| `arrived` | Arrived | Tablet PATCH |
| `failed` | Failed | Tablet PATCH (`error` is yours), or the tablet was removed before it arrived |

The Portal refreshes every 3 s while a send is waiting or downloading.

### Errors

Branch on the HTTP status and `code`.

| Status | `code` | When |
| --- | --- | --- |
| `409` | `machine_has_no_tablet` | No tablet has been on this machine |
| `409` | `tablet_removed` | Its tablet was removed and none added since |
| `409` | `tablet_send_id_reused` | `sendId` already used for other files or another machine |
| `400` | `tablet_files_invalid` | No files, an empty file, or a bad or repeated name; `names` not matching the files |
| `400` | `tablet_too_many_files` | More than 32 files |
| `413` | `tablet_file_too_large` | A file over 5 MiB |
| `413` | `tablet_send_too_large` | Over 20 MiB in one send |
| `400` | none | `sendId` not a UUID, `names` missing, unknown field |
| `401` | none | Not signed in |
| `403` | none | Role lacks the permission, or view-only access to the machine |
| `403` | `machine_control_disabled` | Machine Control is off for the sender's or the machine owner's organisation |
| `403` | `machine_inactive` | The machine isn't active |
| `403` | `feature_not_in_plan` or similar (`feature` is set) | The owning organisation's plan has ended |
| `404` | none | No such machine, or no access to it |

```json
{ "code": "tablet_removed", "message": "This machine's tablet was disconnected. Add it again before sending.", "error": "Conflict", "statusCode": 409 }
```

Only `status` and `code` are guaranteed; the other keys vary.

## Limits

| | |
| --- | --- |
| File types | **Any.** Contents are not inspected; stored and served as `application/octet-stream` |
| Per file | 1 byte to 5 MiB (5,242,880 bytes) |
| Per send | 20 MiB (20,971,520 bytes), 32 files |
| Names | Up to 200 characters, no folders, Windows-compatible (no `< > : " / \ \| ? *` or control characters, no leading space, no trailing dot or space, no reserved names such as `CON`), unique ignoring case |

These are the existing design delivery limits.

## Tablet side: design delivery is unchanged

`GET /mc/device/designs/next`, `GET /mc/device/designs/{deliveryId}/files/{index}`
and `PATCH /mc/device/designs/{deliveryId}` have **no changes** to requests,
responses, status rules or errors.

A send looks like any other delivery:

```json
{
  "delivery": {
    "id": "9c1b6c1e-1d0a-4f0e-9a43-1f2b9d7a5c10",
    "projectId": "project-uuid",
    "project": "Remote session files",
    "versionId": "version-uuid",
    "status": "waiting",
    "files": [{ "path": "surface.dxf", "sizeBytes": 123456, "sha256": "64 lowercase hexadecimal characters" }]
  }
}
```

- `path` is a bare file name for these sends.
- `projectId` is stable for one sending organisation. If the machine's owner
  and an organisation it is shared with both send, there are two `projectId`s
  with the same `project` name. Keep folders keyed by `projectId`.
- Deliveries are still handled one at a time, oldest first. A send queues
  behind any design delivery already waiting for that tablet.

## New socket event: `design:available`

Namespace `/machine-app`, to the tablet's own device room.

```json
{
  "deliveryId": "9c1b6c1e-1d0a-4f0e-9a43-1f2b9d7a5c10",
  "machineId": "3f0c9a52-8f4e-4d57-9d0b-5a1c2e7b9f10",
  "deviceId": "b71d4c0e-2a95-4f3a-8c61-0d9e5b4a7c22"
}
```

- Sent for **every** new design delivery, including those from
  **Machine Control → Files**, not only Send to tablet.
- It is a hint: on receipt, run the usual `GET /mc/device/designs/next` unless
  a delivery is already in progress. `deliveryId` may not be the one `next`
  returns (an older one comes first).
- Best-effort and not replayed. **Keep the 10 s poll** and poll on reconnect.
- Ignoring the event is safe.

## History

Each send adds a **Files to tablet** entry to the machine's History: sender,
time, file names and sizes, and the current status. The entry belongs to the
machine's owning organisation. The history API returns it with `entryType`
`file_transfer` and a `fileTransfer` object (`status`, `error`, `files`). It
also appears in the machine's audit log, and under **Files during this
session** on a remote session entry when sent during one.

The versions also appear in the sender's **Machine Control → Files** library
under **Remote session files**.
