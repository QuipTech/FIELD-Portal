# Remote support requirements from Red Edge

TeamViewer is blocked on the cab tablets. This document records the requested remote-support workflow. The support-initiated session, recording, transcript and History entry are implemented; the API, events and Windows work are in the [remote support contract](remote-support-contract.md). The backend supports operator-initiated **Request help**. Windows integration and the Portal notification and Join UI remain. See the [Windows handoff](windows-remote-session-handoff.md).

## Installation and pairing

- Red Edge installs FIELD Machine on the Windows cab tablet and registers the tablet serial, customer, machine and site with a six-digit code.
- The tablet receives a dedicated credential. An authorised Portal user can disable a lost tablet. The working API and code direction are documented in the [existing pairing and disconnect contract](tablet-disconnect-contract.md). The original brief described the tablet displaying the code, while the current installation uses the existing Portal-generated code flow.

## Support-initiated session

- An authorised supervisor or Red Edge support user clicks **Connect** on a machine in the Portal.
- The tablet shows the session request. The operator can **Allow** or **Decline**.
- With consent, support views the live screen in a browser and can tap, type and scroll. Common tasks include moving a design into the machine-control software and helping with settings.
- Either side can end the session. The session is logged and the tablet shows a **Recording** indicator during recording.

## Operator-initiated session

- The operator selects **Request help**. Support receives a notification and joins the session under the consent already provided by the operator's request.

## Recordings and history

- Automatically record remote sessions and screen shares. Save the recording in the cloud after the session and transcribe it.
- Add a **Remote session** entry to the machine's History tab with the support user, date, duration, recording and transcript.
- Authorised supervisors and Red Edge support can replay the recording and search the transcript.

## Files and traceability

- Keep design uploads, versions and per-machine delivery history in the Portal. Design receipt is based on the version activated in the FIELD Machine Files folder.
- Keep tablet exports such as as-builts, logs and config backups under the machine and site. The desired export workflow includes both operator-triggered and scheduled sends.
- Keep recordings and transcripts with the machine's session history.
