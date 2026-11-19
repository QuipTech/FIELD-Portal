# Windows developer handoff for Portal design delivery

The surveyor uploads a project folder in **Machine Control → Files**, selects a version and targets one machine, several machines or the eligible paired machines at a site. The Portal reviews the package and its predecessor per tablet before confirming. Selecting an earlier version and sending it again rolls the project back on those tablets. The sending organisation keeps every uploaded version in its library. The sender and the machine’s owning organisation can see the delivery in history for machines they can access.

This is Portal-to-tablet delivery. The existing [tablet-to-Portal document upload](tablet-document-upload-contract.md) uses `POST /mc/device/files`. The [pairing and disconnect contract](tablet-disconnect-contract.md) still applies.

## Windows work

1. Start a single background delivery worker after validating the existing pairing. Poll when the app starts, after reconnecting, and about every 10 seconds when idle. Keep the worker independent of the UI. Start a new poll after finishing a delivery.
2. Keep durable delivery state keyed by `deviceId` and delivery ID, including partial files, the last verified file, and the committed activation awaiting acknowledgement. On disconnect or pair replacement, stop that worker and keep its pending state isolated from the next pairing. Token rotation on the same pairing can continue the work.
3. Download into a private staging area. Map the project to a stable local directory keyed by `projectId`, and display the API's `project` label under the app's **Files** folder. Preserve each relative path. Resolve paths under staging, reject absolute paths and traversal, and prevent reparse points from escaping the staging directory. Treat DXF, LandXML, localisation, and configuration files as opaque data. Expose them for operator use in the app's Files folder.
4. Resume partial files using the byte range from the local length. With `206`, verify that `Content-Range` starts at the requested offset before appending. With `200`, replace the partial with the full response. For an expired signed URL, request a new URL from the API and resume. For `416`, verify an already-complete partial or discard it and restart. Retry network errors, `429`, and transient server failures with exponential backoff and jitter. Never include the FIELD bearer token on the signed storage request.
5. Verify the final length and SHA-256 of every file. Retry a checksum mismatch from byte zero before reporting a permanent failure. Once the whole version verifies, activate it with a single recoverable change, for example a persisted pointer to a fully staged version directory. The old active version remains visible during download. On restart, reconcile the activation journal before acknowledging or starting another delivery. The active project consists of exactly the new manifest, including removal of paths absent from it. Only manage files in the app's project directory.
6. Report `arrived` after the new version is active in **Files**. Persist and replay an unacknowledged status after restart, including when the server committed the update but the response was lost. Show downloading and retry state in the app. Report `failed` for an unrecoverable error with a short operator-readable reason. A supervisor can send that version again from the Portal.

## API contract

Use the pairing API base URL and `Authorization: Bearer <deviceToken>` on all three FIELD requests. Staging base URL is `https://staging-api.quiptechfield.com.au`. File indexes are zero-based in manifest order.

| Request | Response |
| --- | --- |
| `GET /mc/device/designs/next` | `200` with `{ "delivery": null }` or the oldest pending delivery |
| `GET /mc/device/designs/{deliveryId}/files/{index}` | `200` with `{ "url": "…", "expiresAt": "…" }` for the active delivery. GET the signed URL directly, with an optional `Range: bytes=<offset>-` header. |
| `PATCH /mc/device/designs/{deliveryId}` | JSON `{ "status": "downloading" }`, `{ "status": "arrived" }`, or `{ "status": "failed", "error": "…" }`. On success returns `200` with `{ "status": "…" }`. |

```json
{
  "delivery": {
    "id": "delivery-uuid",
    "projectId": "project-uuid",
    "project": "North Pit",
    "versionId": "version-uuid",
    "status": "waiting",
    "files": [
      {
        "path": "surfaces/north.dxf",
        "sizeBytes": 123456,
        "sha256": "64 lowercase hexadecimal characters"
      }
    ]
  }
}
```

- A poll can return `waiting` or `downloading`. PATCH `downloading` before transferring. `arrived` and `failed` are terminal. Repeating the same PATCH is safe, including after a terminal acknowledgement. After `409`, poll again and reconcile the local journal. After `404` for a job or file, poll again and confirm the job is still active.
- On `401 DEVICE_TOKEN_REVOKED`, try the latest saved token and apply the existing session validation and re-pair rules. `403` means the machine is inactive or its organisation has disabled Machine Control. Pause and recheck later. Existing signed URLs expire independently of API access and must be kept private.
- An upload supports up to 32 files, 5 MiB per file and 20 MiB total. All paths are relative, Windows-compatible and case-insensitively unique. Do not assume a fixed extension list. A new Windows installation or replacement pairing receives only deliveries submitted to its own pairing. Send the version again from the Portal to seed it.

## Acceptance checks on a Windows tablet

1. Deploy the Portal and API build with database migration `0134_machine_design_delivery` and the existing private object storage configured.
2. Upload a design with nested paths and send it to a paired offline tablet. Confirm the Portal shows **Waiting** with no Portal tab required for delivery. Bring the tablet online and confirm **Downloading**, then **Arrived**, with the same nested paths under Files.
3. Interrupt 4G after receiving part of a file and restart the app. Verify the next storage request uses the saved range and the final checksum matches. Test refreshing the signed URL during resume and replaying an acknowledgement after a lost response.
4. Upload and send a second version that changes a file and removes one. Check the preview per machine and confirm the previous version remains active until the whole replacement verifies. Send the old version back to one machine and confirm the previous set is restored there.
5. Send to multiple paired machines and use a site target. Confirm each tablet receives only its job. Disconnect a tablet during download and verify a replacement pairing cannot fetch the old job.
