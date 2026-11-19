# Remote support contract (Windows FIELD Machine app)

The support-initiated backend and Portal flow uses migration `0139`. The
operator-initiated backend flow uses migration `0140` and is documented in the
[Windows handoff](windows-remote-session-handoff.md).
Pairing, device tokens and the `/machine-app` socket are unchanged; see
[tablet-disconnect-contract.md](tablet-disconnect-contract.md).

API: `https://staging-api.quiptechfield.com.au` (no `/api` prefix).
Every tablet call uses `Authorization: Bearer <current deviceToken>`. A
rejected token is `401` with `code: "DEVICE_TOKEN_REVOKED"`, as today.

## How a session runs

1. A Portal user with `mc.remote` clicks **Connect as remote access** on the
   machine's **Machine app** tab. The Portal opens a small window and calls
   `POST /machines/{machineId}/remote-sessions`. The tablet must be online
   (socket connected) or the Portal gets `409 remote_tablet_offline`.
2. The tablet receives the socket event `remote:requested` and shows
   **Allow / Decline** with the requester's name, the expiry countdown, and
   that the session is **recorded** and (if `scope.control`) **controlled**.
3. The operator answers: `POST /mc/device/remote-sessions/{id}/decision`.
4. On Allow, the tablet calls `POST /mc/device/remote-sessions/{id}/connection`,
   opens the returned presigned WebSocket, and acts as the **WebRTC MASTER**:
   it answers the viewer's offer and streams its screen.
5. While the session is `active`, the tablet shows a **Recording** indicator
   and heartbeats every 15 seconds.
6. Either side ends it. The backend also ends it after 10 minutes without
   interaction, 60 seconds without a heartbeat from either side, 4 hours, or
   when the pairing is lost. The tablet hears `remote:ended`.

## Session object

Every remote endpoint (Portal and tablet) returns this shape:

```json
{
  "id": "6f1c0c1e-3b8f-4f7a-9d55-2a1f6c3b7e10",
  "machineId": "…uuid…",
  "deviceId": "…uuid…",
  "status": "requested",
  "initiatedBy": "portal",
  "requester": { "name": "Sam Support" },
  "scope": { "view": true, "control": true, "record": true },
  "createdAt": "2026-11-19T04:10:00.000Z",
  "expiresAt": "2026-11-19T04:11:00.000Z",
  "startedAt": null,
  "endedAt": null,
  "endReason": null,
  "endedBy": null,
  "durationSeconds": null,
  "recording": { "status": "pending", "error": null },
  "transcript": { "status": "none" },
  "heartbeatSeconds": 15,
  "inactivityMinutes": 10
}
```

- `status`: `requested` → `active` | `declined` | `expired` | `cancelled`;
  `active` → `ended`. Only `requested` and `active` are open.
- `endReason`: `declined`, `expired`, `cancelled` (Portal cancelled before an
  answer), `portal_ended`, `tablet_ended`, `inactive`, `viewer_lost`,
  `tablet_lost`, `unpaired`, `max_duration`.
- `endedBy`: `portal`, `tablet` or `system`.
- `scope.control` is what was requested while `requested`, and what was
  granted once `active`.
- `recording.status`: `pending` (not started yet), `recording`, `completed`,
  `failed`, `none` (never ran).

## Tablet endpoints

All need the device token. The machine must be active with Machine Control on,
otherwise `403 remote_support_unavailable_for_machine`.

### GET /mc/device/remote-sessions/current

The tablet's open session, if any. Call it on app start, after every socket
reconnect, and as a fallback poll (suggested: every 10 s while the app is in
the foreground and no session is open) in case a socket event was missed.

```json
{ "session": { …session object… } }
```
or `{ "session": null }`.

### GET /mc/device/remote-sessions/{id}

One of this tablet's sessions. `404 remote_session_not_found` for another
tablet's session.

### POST /mc/device/remote-sessions/{id}/decision

```json
{ "decision": "allow", "allowControl": true }
```

`allowControl` is optional (default `true`). `false` lets the operator allow
viewing only. Response `200`: the session (`active` or `declined`).

| Case | Result |
| --- | --- |
| Same answer again (a retry) | `200`, same session, nothing changes |
| Allow after Decline, or Decline after Allow | `409 remote_session_closed` |
| Request past `expiresAt` | `410 remote_session_expired` |
| Another tablet's session | `404 remote_session_not_found` |

Retry on network failure or 5xx with the same body: it is idempotent. Stop
on 4xx.

### POST /mc/device/remote-sessions/{id}/connection

Only while the session is `active` (`409 remote_session_not_active`
otherwise). Response `200`:

```json
{
  "sessionId": "…",
  "role": "MASTER",
  "region": "ap-southeast-2",
  "channelArn": "arn:aws:kinesisvideo:ap-southeast-2:…:channel/field-remote-…/…",
  "clientId": null,
  "viewerClientId": "viewer-3f9a…",
  "signalingUrl": "wss://v-xxxx.kinesisvideo.ap-southeast-2.amazonaws.com/?X-Amz-ChannelARN=…&X-Amz-Signature=…",
  "iceServers": [
    { "urls": ["stun:stun.kinesisvideo.ap-southeast-2.amazonaws.com:443"] },
    { "urls": ["turn:…:443?transport=udp", "turns:…:443?transport=tcp"], "username": "…", "credential": "…" }
  ],
  "expiresAt": "2026-11-19T04:16:00.000Z",
  "controlAllowed": true
}
```

- `signalingUrl` is already signed by the backend. **The tablet needs no AWS
  credentials and no AWS SDK.** Open it with a plain WebSocket before
  `expiresAt` (5 minutes). Once open, the socket stays open. To reconnect
  after a drop, call this endpoint again for a fresh URL.
- **Answer only offers whose `senderClientId` equals `viewerClientId`.**
  Ignore anything else. Old URLs can't join a new session, and each session
  has its own channel, which the backend deletes when the session ends.
- `controlAllowed: false` means view only: ignore all control messages.
- `503 remote_support_unavailable`: AWS is unavailable or remote support is
  switched off. Retry with backoff (1, 2, 4, 8, max 30 s).

### POST /mc/device/remote-sessions/{id}/heartbeat

```json
{ "interacted": true }
```

Every `heartbeatSeconds` (15 s) while `active`. `interacted` is `true` when
the operator touched or typed on the tablet locally since the last heartbeat.
The Portal reports its own input. The session ends after
`inactivityMinutes` (10) with no interaction from either side, or 60 s
without a heartbeat from either side. Response: the session. If `status` is no
longer `active`, stop streaming at once.

### POST /mc/device/remote-sessions/{id}/end

No body. Response: the session (`ended`, `endReason: "tablet_ended"`; a
`requested` session becomes `declined`). Ending a closed session returns it
unchanged, so retries are safe.

## Socket events (existing `/machine-app` namespace)

Delivered to the tablet's device room and the machine's Portal watchers,
alongside the existing `session:*` pairing events. The `session:*` events are
about pairing and presence only. Remote support uses `remote:*`.

| Event | When |
| --- | --- |
| `remote:requested` | A Portal user pressed Connect: show Allow/Decline |
| `remote:help_requested` | The tablet operator requested help |
| `remote:accepted` | The operator allowed or a support user claimed a tablet help request |
| `remote:declined` | The operator declined (or the tablet ended a waiting request) |
| `remote:ended` | Ended for any reason, including expiry, cancel, inactivity and unpairing |
| `remote:recording` | Recording status changed (`recording`, `completed`, `failed`) |

Payload:

```json
{
  "sessionId": "…", "deviceId": "…", "machineId": "…",
  "status": "requested", "reason": null,
  "requester": { "name": "Sam Support" },
  "expiresAt": "…", "startedAt": null, "endedAt": null,
  "scope": { "view": true, "control": true, "record": true },
  "recording": "pending"
}
```

Events are best-effort (no acknowledgement). Always reconcile with
`GET …/current` after reconnecting. Two Connect clicks can't produce two
requests: a tablet has at most one open session, and a second Connect gets
`409 remote_session_busy`.

## WebRTC signaling (Kinesis Video Streams protocol)

Frames on the signaling WebSocket are JSON. `messagePayload` is base64 of the
JSON SDP or ICE candidate.

Viewer → tablet (received by the tablet):

```json
{ "messageType": "SDP_OFFER", "senderClientId": "viewer-3f9a…", "messagePayload": "<base64 {\"type\":\"offer\",\"sdp\":\"…\"}>" }
{ "messageType": "ICE_CANDIDATE", "senderClientId": "viewer-3f9a…", "messagePayload": "<base64 {\"candidate\":\"…\",\"sdpMid\":\"0\",\"sdpMLineIndex\":0}>" }
```

Tablet → viewer (sent by the tablet):

```json
{ "action": "SDP_ANSWER", "recipientClientId": "viewer-3f9a…", "messagePayload": "<base64 {\"type\":\"answer\",\"sdp\":\"…\"}>" }
{ "action": "ICE_CANDIDATE", "recipientClientId": "viewer-3f9a…", "messagePayload": "<base64 candidate JSON>" }
```

Also handle `GO_AWAY` (reconnect with a fresh `connection` call) and
`STATUS_RESPONSE` (log it).

Media the viewer offers:

- **video**, `recvonly` on the viewer: the tablet sends its screen.
  Suggested: up to 1920×1080 at 15 fps, H.264 or VP8.
- **audio**, `sendrecv`: the tablet sends its microphone if it has one, and
  plays the viewer's microphone. Both go into the recording and the
  transcript.
- **data channel** `control`, ordered, created by the viewer.

## Control messages (data channel `control`, protocol v1)

JSON text messages. `x` and `y` are fractions (0 to 1) of the streamed
screen. Map them to the real desktop coordinates and inject with
`SendInput`. Apply only when `controlAllowed` is `true`.

```json
{ "v": 1, "type": "pointer", "action": "down", "x": 0.42, "y": 0.61, "button": 0 }
{ "v": 1, "type": "pointer", "action": "move", "x": 0.43, "y": 0.61, "button": 0 }
{ "v": 1, "type": "pointer", "action": "up",   "x": 0.43, "y": 0.61, "button": 0 }
{ "v": 1, "type": "wheel", "x": 0.5, "y": 0.5, "deltaX": 0, "deltaY": 120 }
{ "v": 1, "type": "key", "action": "down", "key": "a", "code": "KeyA", "alt": false, "ctrl": false, "shift": false, "meta": false }
{ "v": 1, "type": "text", "text": "pasted text" }
```

- `action` is also `cancel` (treat it as `up`). `button`: 0 left, 1 middle,
  2 right. Moves without a preceding `down` are hover moves.
- `key` and `code` are browser `KeyboardEvent` values. Map `code` to Windows
  virtual-key codes. `text` should be typed with `KEYEVENTF_UNICODE`.
- Never inject secure-desktop sequences (Ctrl+Alt+Del). Ignore unknown
  `type` or `v` values.

## Recording

- **Who records:** the Portal viewer records the stream it receives (screen
  plus both microphones) and uploads it while the session runs. The backend
  completes it in S3 (`documents/{tenantId}/remote-sessions/{machineId}/{sessionId}/recording.webm`),
  then AWS Transcribe (en-AU) produces the transcript.
- **Tablet's job:** show a clear **Recording** indicator whenever the session
  is `active` and `scope.record` is `true`, from Allow until it ends.
  `remote:recording` with `"recording": "failed"` means the copy could not be
  kept. The session still runs. Show "Recording failed" if you want, but
  don't end the session.
- If the viewer's window closes, whatever was uploaded is kept. At most the
  last ~40 s can be lost.
- Each session adds a **Remote session** entry to the machine's History with
  requester, date, duration, playback and searchable transcript. Playback
  and the transcript need Portal login, machine access and `mc.remote`.

## What the Windows team needs to build

1. Listen for `remote:*` on the existing socket. On start and reconnect, call
   `GET /mc/device/remote-sessions/current`.
2. An Allow / Decline prompt (on top, focus-stealing, with a countdown to
   `expiresAt`) showing the requester name, "Recording" and "Control" (if
   `scope.control`), and an option to allow view only (`allowControl: false`).
   Hide it on `remote:ended`, `remote:declined` or expiry.
3. A WebRTC MASTER over the presigned `signalingUrl` (plain WebSocket plus
   WebRTC, for example libwebrtc, Microsoft MixedReality-WebRTC or
   SIPSorcery). Use the `iceServers` given. Answer only `viewerClientId`.
4. Screen capture (Windows Graphics Capture or DXGI Desktop Duplication) of
   the primary display, plus an optional microphone track. Play the viewer's
   audio.
5. Input injection from the `control` data channel (`SendInput`), only when
   `controlAllowed`.
6. A Recording indicator and an **End session** button (`POST …/end`) visible
   during the whole session.
7. A heartbeat every 15 s with `interacted` (local touch or keyboard since
   the last one, from `GetLastInputInfo` excluding injected input).
8. Stop capture and close the peer connection immediately when the session
   isn't `active` any more (`remote:ended`, a heartbeat response, `…/end`
   response, `401 DEVICE_TOKEN_REVOKED`, or unpairing).

## Test fixtures

Backend tests (`backend/test/machineSharing/remoteSession.spec.ts`) cover:
Allow, a retried Allow, Decline, a retried Decline, Allow after Decline,
expiry plus sweep, busy, offline tablet, unpaired machine, a cross-machine
tablet denied (decision, end, connection), another organisation denied,
inactivity, lost pairing, recording completion, a retried part, a missing
recording, and the History entry and usage event.

## Staging setup still needed (DevOps)

- Set `REMOTE_SUPPORT_KVS_ENABLED=true` (and optionally
  `REMOTE_SUPPORT_KVS_REGION`, default `ap-southeast-2`) on the API.
- Grant the API task role `kinesisvideo:CreateSignalingChannel`,
  `DescribeSignalingChannel`, `GetSignalingChannelEndpoint`,
  `GetIceServerConfig`, `ConnectAsMaster`, `ConnectAsViewer`,
  `DeleteSignalingChannel` and `TagResource` on
  `arn:aws:kinesisvideo:ap-southeast-2:<account>:channel/field-remote-*/*`.
- Grant `transcribe:StartTranscriptionJob` and `transcribe:GetTranscriptionJob`,
  plus S3 multipart permissions (`s3:PutObject`, `s3:AbortMultipartUpload`,
  `s3:ListMultipartUploadParts`) on `documents/*`.
- Apply migration `0139_mc_remote_sessions.sql`.
- A paired test tablet and a Portal account with `mc.remote` (Owner or
  Organisation Admin) on an organisation with Machine Control on, through
  the existing secure access process.
