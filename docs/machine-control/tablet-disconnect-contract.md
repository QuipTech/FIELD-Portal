# Tablet disconnect and presence contract

## Environments and evidence

Portal: https://staging.quiptechfield.com.au
API: https://staging-api.quiptechfield.com.au (no `/api` prefix).
Socket.IO namespace `/machine-app`, transport path `/socket.io`.

On 2026-11-17 at 16:21:09 UTC, read-only SSM inspection of the staging host
confirmed both API and Portal images tagged with build
`79e33c9f328de4a36b3e780fcf98dd55e6d251bf`. Inspection of the running API
confirmed the registered DeviceSessionController, MachineAppGateway,
MachineAppEventListenerService and MachineAppHeartbeatService, plus the
0128 migration file. This is newer than the user's original checkout
`f65817b99b30c358e3f3fe2c399ad7e48ddba8ba`.

At 16:19:16 UTC, that deployed API returned HTTP 404 for `/build`.
This change adds `/build` and bakes the Git SHA into subsequent API images.
Image/code inspection is not an authenticated tablet reproduction. The
Windows executable version and physical tablet results remain for the operator
to record. Do not report anonymous 401 probes as authenticated end-to-end tests.

## Windows operation (existing route, retry behavior fixed by migration 0130)

`DELETE /mc/device/session`

- Authentication: `Authorization: Bearer <current Windows deviceToken>`.
- No machine ID, request body, Portal JWT or Socket.IO command is required.
- Success: HTTP **204**, empty response body.
- A retry with a credential belonging to that already-disabled device also
  returns **204**, without another end event and without affecting a replacement.
- Unknown/missing/malformed token, or an expired rotated token belonging to a
  still-active device: HTTP **401**, JSON containing
  `code: "DEVICE_TOKEN_REVOKED"`. This code does not distinguish those causes.
- HTTP 204 means the transaction committed: all device credentials, including
  refresh-grace credentials, are revoked immediately; the active association
  is removed by disabling its `mc_devices` row; `online_socket_id` and
  `online_since` are cleared. Historical machine/device rows remain for audit.
- The committed transaction announces `session:ended` through PostgreSQL
  `mc_device_event`. Every listening API instance forwards the event to its
  relevant Portal and tablet sockets, then closes the tablet device room.
  Event delivery is not acknowledged by HTTP 204. A heartbeat reconciliation
  closes revoked/replaced device sockets within the next 30-second heartbeat
  if the listener missed a notification (plus service/database latency).

Windows integration sequence:

1. Mark permanent Forget pending and stop new reconnect attempts. Retain the
   credential securely until the operation is resolved; never print it.
2. Send DELETE using the current saved credential before removing it.
3. On 204, stop the socket/controller, remove the saved credential and show pairing.
   Handle `session:ended` arriving before the HTTP response as the same transition.
4. On network failure, timeout or 5xx, keep a durable pending action and retry
   the same DELETE when connectivity returns. Suggested backoff: 1, 2, 4, 8,
   then at most 30 seconds with jitter. Honor Retry-After on 429. A lost 204 is safe.
5. On 401, stop using the rejected credential. Do not loop retries or claim
   that a different currently paired device was removed. An expired rotated
   credential cannot revoke the device's current pairing; use the latest saved
   credential or have a Portal operator disconnect it. Other 4xx require diagnosis.

A local-only/offline Forget without a retained pending credential cannot promise
permanent backend unpairing. Ordinary transport disconnect never means unpair.

## Portal operation

`DELETE /machines/{machineId}/app-connection`

Uses the existing Portal user Bearer JWT, enabled Machine Control and
`mc.manage_devices` permission, active-machine guard and machine contribute
access. **It does not accept device tokens.** Success and repeat for an
accessible active machine are HTTP 204. Inaccessible machines still return
404; permission/module failures retain their existing errors.

Both directions now call the same database cleanup primitive. The Portal
operation also cancels unused pairing codes. After either operation, a GET
`/mc/device/session` with the old device token returns HTTP 401 and
`DEVICE_TOKEN_REVOKED`; socket authentication rejects it with connect_error
`DEVICE_TOKEN_REVOKED`.

## Pairing versus presence (existing response and events)

Portal REST: `GET /machines/{machineId}/app-connection`, Portal user auth and
`mc.view`/machine read access. Existing response:

```json
{
  "connected": true,
  "device": { "id": "device UUID", "online": false, "pairedAt": "UTC timestamp" },
  "session": { "status": "pending", "tabletOnline": false, "portalOnline": false }
}
```

`device` also includes serialNumber, platform and appVersion. `connected` is
**Paired**, independent of presence. `session.tabletOnline` is **Online/Offline**.
`session.status` is active only when a tablet and a Portal socket viewer are
both online; pending alone does **not** mean tablet offline. Unpaired response:
`{ "connected": false, "device": null, "session": null }`.

Portal socket authentication is `{ token: <Portal user JWT> }`. Emit `watch`
with `{ machineId }`; acknowledgement is `{ ok: true, ...connectionResponse }`
or `{ ok: false, error: "not_found" }`. Tablet auth remains `{ deviceToken }`.

Events, to authorized machine watchers and the tablet's authenticated device room:

- `session:status`: `{ deviceId, machineId, reason: null, status, tabletOnline, portalOnline }`.
- `session:ended`: `{ deviceId, machineId, reason: "tablet_disconnected" }`
  or reason `"portal_disconnected"` / `"replaced"` as appropriate. Heartbeat
  recovery after a missed notification uses `reason: null` because the original
  reason is no longer available. Tablet sockets are closed after the event.
- `session:started`: `{ deviceId, machineId, reason: null }`, to Portal watchers.

No `tablet:disconnect` socket command is introduced. Permanent unpair uses REST.
The Portal UI in this change polls existing REST responses every five seconds,
so it updates even without a socket subscription or after a missed event. Failed
machine-page refreshes show status unavailable instead of stale Online.

## Deadlines and transport behavior

- Graceful socket closure: backend clears that socket's presence, announces
  session:status; Portal reflects the next successful five-second poll.
- Socket.IO heartbeat defaults are 25-second ping interval / 20-second timeout.
  A typical missing transport is therefore detected within 45 seconds, followed
  by the next Portal poll. Deployment handshake values must be checked.
- Crashed API container: heartbeat updates every 30 seconds; stale threshold
  90 seconds and sweep every 60 seconds give a conservative **150-second**
  backend deadline from last heartbeat, then the next five-second poll.
  Add request/database latency and browser timer throttling to these deadlines.
- Sweeping only changes presence. The previous 30-minute auto-revocation is
  removed by migration 0130; offline pairing remains valid for reconnection.
- Old-socket closure cannot clear a replacement socket's presence. Heartbeats
  must include the current socket ID, so an old socket cannot vouch for a missing
  replacement. Token rotation does not invalidate an already-authenticated socket.

## Operator acceptance after staging deploy

Record `/build` SHA, Windows executable version and UTC times. On a dedicated
machine, test Portal DELETE → event → Windows pairing screen; re-pair and test
Windows DELETE → 204 → Portal unpaired on its next poll. Repeat DELETE privately
using the same old token, then validate its GET produces 401/code; re-pair and
verify that an old-token DELETE cannot remove the replacement. Test network loss
and reconnection without pressing Forget: pairing must remain valid, including
beyond the former 30-minute timeout.

Logs contain socket/device/machine IDs, instance ID, build SHA, UTC time,
disconnect reason and resulting presence; event-forwarding logs record event
names and reason. They never contain device tokens or handshake auth objects.
`session_event_forwarded` proves server emission, not receipt by Windows.
