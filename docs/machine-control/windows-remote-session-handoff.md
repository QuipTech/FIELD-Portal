# Windows tablet remote support handoff

Implement this in the Windows FIELD Machine app. The Portal backend supplies
pairing, session state, consent scope, Kinesis WebRTC signaling, expiry,
recording, transcription, and history. The Windows app owns operator consent,
screen/audio capture, playback, scoped input, and immediate local shutdown.

## Before starting

- Deploy Portal backend migrations **0139 and 0140**, enable Kinesis remote
  support, and confirm the deployed API SHA with `GET /build`.
- Use a dedicated staging machine, a paired Windows tablet, and a Portal test
  user with `mc.remote`, contribute access to the machine, and a remote-session
  entitlement. The staging API base is
  `https://staging-api.quiptechfield.com.au` with no `/api` prefix.
- Use the existing [pairing and disconnect contract](tablet-disconnect-contract.md)
  and [signaling, media and control contract](remote-support-contract.md).
  Use Windows hardware to build and validate the desktop capture and input
  portions.

## Connect the Windows app

1. Use the current paired device token securely. REST uses
   `Authorization: Bearer <deviceToken>`; Socket.IO uses namespace
   `/machine-app`, path `/socket.io`, and auth `{ deviceToken }`. Use the latest
   token after rotation. Keep tokens, signed URLs, and ICE credentials out
   of logs.
2. On startup, socket reconnect, and foreground recovery, call
   `GET /mc/device/remote-sessions/current`. Poll while idle as an event-loss
   fallback. Treat socket events as hints and reconcile by session ID; use
   `GET /mc/device/remote-sessions/{id}` to reconcile an ID already on screen.
   Ignore late events for other sessions. A terminal state clears the
   appropriate prompt or media resources.
3. For a pending session with `initiatedBy: "portal"`, show the requester's
   name, expiry, recording disclosure, and requested control. Offer Allow,
   Allow viewing only, and Decline. Submit the corresponding
   `POST …/{id}/decision` payload from the contract. Hide on expiry and
   reconcile after a network failure. Keep consent bound to the current
   session ID.

## Add operator-initiated Request help

1. Show recording disclosure and make remote control an explicit operator
   choice. Default the UI to view-only. Generate a random UUIDv4 per confirmed
   request before sending `POST /mc/device/remote-sessions/help`:

   ```json
   { "requestId": "37655fcc-71ab-4387-a830-36552b35a52f", "control": false }
   ```

2. HTTP 200 returns the session, normally `requested`, with
   `initiatedBy: "tablet"`. On timeout or retryable errors use the same UUID
   and unchanged body. The ID is also the session ID. A replay can return a
   later or terminal status. A new operator action gets a new UUID. A different
   open session returns `409 remote_session_busy`; reconcile with current.
3. Show **Waiting for support** until the returned `expiresAt` (five minutes
   from creation). Cancel with `POST …/{id}/end`. No Allow/Decline prompt for
   tablet-initiated requests. No screen capture, microphone or input while
   waiting. If the app cannot confirm local consent for a recovered request,
   keep media off and end the session.
4. The API emits `remote:help_requested` to the machine's Portal watchers
   and paired tablet. An authorized Portal client retrieves it with
   `GET /machines/{machineId}/remote-sessions/help/current` (returns
   `{ "session": … }` or `{ "session": null }`), and joins with
   `POST /machines/{machineId}/remote-sessions/{id}/claim`. Claim is HTTP 200,
   needs the Portal user credential, and binds the session to the first
   authorized support user. The same user can retry while it is active;
   another claimant receives 409. An expired request receives 410.
5. After `remote:accepted`, reconcile and start only on `active`, with the
   original consent. The API preserves the scope chosen by the operator.
   The existing Portal Connect UI handles the support-initiated flow. For
   Request help acceptance, use an authenticated Portal test client for
   discovery and claim, then use an authorized test WebRTC viewer with
   `POST /machines/{machineId}/remote-sessions/{id}/connection` and
   `POST …/{id}/heartbeat` on the returned cadence. A Portal user-facing notification/Join UI
   is a separate frontend change. The socket event reaches connected machine
   watchers; the backend does not send email or push notifications.

## Run and stop the connection

- Call `POST /mc/device/remote-sessions/{id}/connection` for a fresh MASTER
  connection on each signaling reconnect. Use exactly the returned ICE
  configuration and answer only the designated `viewerClientId`. Advertise
  the captured screen track, optional microphone, and supported codecs as
  described in the signaling contract. Show the active session and recording
  indicator, with an always-accessible **End session** action.
- Accept input only on the current authenticated viewer's negotiated
  `control` data channel while the session is active and the returned
  `controlAllowed` is true. Validate messages and coordinates. Use the
  streamed monitor bounds and test DPI scaling, alternate monitor layouts,
  and release of pressed keys/buttons on shutdown.
- Heartbeat on the returned cadence (15 seconds). Set `interacted` only for
  actual local operator activity; keep ordinary heartbeats independent of
  activity. On a terminal response/event, local End, pairing loss, or
  revoked-token response, stop capture, audio, input, transfers and timers,
  and close the peer and signaling connections. When transport is lost,
  pause capture and input until the same session and consent are confirmed.
  On local End, stop first and retry the idempotent API end on a retryable
  failure. Handle permanent unpair separately using the disconnect contract.

## End-to-end acceptance on a dedicated tablet

Record the API SHA, Windows build, UTC times and session IDs. Keep credential
material out of evidence.

| Scenario | Expected result |
| --- | --- |
| Portal Connect → Decline or expiry | No capture or input; Portal sees the terminal state. |
| Portal Connect → Allow viewing only | Screen renders in Portal; all control messages are ignored. |
| Portal Connect → Allow control | Approved viewer can interact; mouse, touch mapping, keyboard and paste work at the tablet DPI. |
| Tablet Request help → authorized claim | Waiting UI before claim; exactly one support user can join; media starts only after active. View-only stays view-only. |
| Retry a lost help response / retry a claim | Same request ID, one session and one help notification; claim retry by the same user succeeds while active. |
| Cancel or expire a help request before claim | No media; claim fails; a fresh operator action can start a new request. |
| Missed event / socket reconnect | REST restores state without another prompt or session. No capture resumes without current consent and active status. |
| End from either side, heartbeat loss, unpair, or process exit | Capture and input stop, pressed input is released, Portal state converges, and an old tablet token cannot rejoin on unpair. |
| Completed session with recording | History contains the support user and duration. Authorized playback and transcript work after processing. |
