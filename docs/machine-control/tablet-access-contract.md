# Tablet access by FIELD ID and password

Replaces the 6-digit pairing code (migration `0143`). A tablet has a permanent
9-digit **FIELD ID** and a password. A Portal user adds it to a machine once,
then connects with the password. Nothing is accepted on the tablet.

API base: `https://staging-api.quiptechfield.com.au` (no `/api` prefix).

## Two tokens

| Token | Used for | Lifetime |
| --- | --- | --- |
| `tabletToken` | `/mc/device/registration…` only | Permanent |
| `deviceToken` | Socket.IO, remote sessions, files, designs (as before) | While the tablet is on a machine |

## Tablet endpoints

| Call | Body | Result |
| --- | --- | --- |
| `POST /mc/device/register` | `{ password, serialNumber?, platform?, appVersion? }` | `201 { fieldId, tabletToken }`. 5 per minute per IP. |
| `GET /mc/device/registration` | | `{ fieldId, assigned, machine: { id, label } \| null }` |
| `PUT /mc/device/registration/password` | `{ password }` | `204`; `409 tablet_password_managed_in_portal` once added |
| `POST /mc/device/registration/session` | | `{ deviceId, deviceToken, machine }`; `409 tablet_not_assigned` |

`registration` calls send `Authorization: Bearer <tabletToken>`; a rejected one
is `401 TABLET_TOKEN_INVALID`. Passwords are 8 to 128 characters.

- While `assigned` is false, poll `GET …/registration` every 5 s.
- When it becomes true, call `POST …/session` and carry on as a paired tablet.
  Each call replaces the earlier device token.
- `401 DEVICE_TOKEN_REVOKED` or `session:ended`: drop the device token (keep
  the tablet token and FIELD ID) and go back to polling the registration.

**A tablet already paired with a code** registers once with
`Authorization: Bearer <deviceToken>` on `POST /mc/device/register`. It keeps
its machine and device token. Until then it keeps the Allow/Decline flow.

## Unattended sessions

Session objects and `remote:*` payloads have `access`: `unattended` (tablet with
a FIELD ID) or `prompt`. An unattended session is created `active`: the tablet
gets `remote:accepted` without `remote:requested`, and calls
`POST /mc/device/remote-sessions/{id}/connection` at once. It must heartbeat
within 60 s, so keep the socket open and poll `…/current` every 10 s while idle.
`scope.control` false means view only. Everything else is in the
[remote support contract](remote-support-contract.md).

## Portal endpoints

| Call | Permission |
| --- | --- |
| `POST /machines/{id}/app-connection/tablet` `{ fieldId, password }` | `mc.manage_devices` |
| `PUT /machines/{id}/app-connection/tablet/password` `{ password }` | `mc.manage_devices` |
| `DELETE /machines/{id}/app-connection` (remove) | `mc.manage_devices` |
| `POST /machines/{id}/remote-sessions` `{ password, control }` | `mc.remote` |
| `POST /mc/remote-access/connect` `{ fieldId, password, control }` | `mc.remote` |

All also need Portal sign-in, Machine Control and `contribute` access to the
machine. Wrong ID, wrong password and another organisation's tablet all answer
`400 tablet_credentials_invalid`. Five wrong passwords: `429 tablet_locked`
for 15 minutes; a Portal password reset unlocks.

## Rules to know

- The first organisation to add a tablet keeps it. Moving one to another
  organisation currently needs a database change.
- Removing a tablet keeps its FIELD ID and password.
- Reinstalling without the stored tablet token gives a new FIELD ID.
- The old `pairing-code` and `/mc/device/pair` routes still work for tablets
  not yet updated. The Portal no longer offers codes.
