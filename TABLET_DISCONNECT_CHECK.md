# Task: Investigate tablet still showing Connected after portal disconnect

Please investigate and fix this issue in the Windows FIELD machine/tablet app.

## Observed issue

The user pairs the tablet with a machine successfully. When they click Disconnect in the FIELD portal, the portal shows the machine app as disconnected, but the Windows tablet app continues to display Connected.

Do not assume the fault is in the tablet app. Check the client behavior and capture evidence to distinguish a client state issue from a backend event/deployment issue.

## Backend contract from the portal repository

- Pairing: `POST <BACKEND_URL>/mc/device/pair` returns a `deviceToken`.
- Live connection: Socket.IO namespace `/machine-app`, with handshake auth `{ deviceToken: "<saved token>" }`. Use a Socket.IO client, not a plain WebSocket client.
- When the portal disconnects the device, the backend is designed to emit `session:ended` to the tablet's device room and then disconnect its socket.
- The event payload contains `deviceId`, `machineId`, and `reason: "portal_disconnected"`. Other end reasons include `tablet_disconnected`, `replaced`, and `connection_timeout`.
- A subsequent socket connection with the revoked token should fail with `connect_error` whose message is `DEVICE_TOKEN_REVOKED`.
- Session validation: `GET <BACKEND_URL>/mc/device/session`, with `Authorization: Bearer <deviceToken>`.
- A revoked token should return HTTP 401 with JSON containing `code: "DEVICE_TOKEN_REVOKED"`.

Use the same backend environment as the portal being tested. Include any configured API base path in BACKEND_URL.

## Required investigation and fix

1. Check that the tablet actually opens the authenticated Socket.IO connection after pairing and registers its event handlers before connecting.
2. Check whether `session:ended` is received when Disconnect is clicked in the portal. Log the event name, end reason, connection errors, and socket disconnect reason. Never log device tokens or authorization headers.
3. On `session:ended`, clear the saved device token, paired machine details, cached pairing state, and Connected UI state. Stop session-specific work and return to the pairing screen. Make cleanup safe to run more than once.
4. Handle `connect_error` with message `DEVICE_TOKEN_REVOKED` and REST HTTP 401 with code `DEVICE_TOKEN_REVOKED` using the same cleanup.
5. Validate the saved pairing using the session endpoint on app startup/resume and when recovering a lost connection. Do not restore Connected solely because a token exists in local storage.
6. Treat ordinary network loss as offline/reconnecting, and validate the session when connectivity returns. A temporary transport failure alone should not erase a valid pairing.
7. On a server-initiated socket disconnect, validate the session so the UI can recover even if the end event was missed. Ensure reconnect callbacks or pending API responses cannot restore stale Connected state after pairing has been cleared.

## Diagnostic test

After portal disconnect, call the session endpoint with the OLD tablet token, keeping the token private:

```http
GET <BACKEND_URL>/mc/device/session
Authorization: Bearer <OLD_DEVICE_TOKEN>
```

- **401 + DEVICE_TOKEN_REVOKED:** revocation works. Check whether the app receives the event and clears local state.
- **200:** report a possible backend revocation/deployment issue or mismatched environments; confirm both sides use the same backend.
- **401 but no session:ended event:** check tablet socket connectivity. Ask the backend developer to verify deployment of the machine-app gateway/listener, database migration `0128_machine_app_live_session.sql`, and PostgreSQL `mc_device_event` notifications. The symptom alone does not prove which component failed.

## Acceptance checks

- Pair tablet, disconnect from portal while tablet is online: tablet returns to pairing screen and remains unpaired after restart.
- Disconnect from portal while tablet is offline: tablet detects revoked pairing when online again or on next startup/resume.
- Restart with a revoked token: app clears pairing after validation.
- Temporary network loss with a still-valid token: app can recover without requiring a new pairing code.
- Pair again with a new code after revocation: the new session works and old callbacks do not clear or overwrite it.

Please implement the necessary client fix, run the relevant checks, and report the root cause, changed files, test results, and any backend evidence/blocker. If the backend contract differs in the deployed environment, report the actual response/event instead of guessing.
