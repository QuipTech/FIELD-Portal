# Windows tablet file transfer

## Windows app behavior

1. Show **Send to Portal** when the tablet has a valid pairing. Use the machine label from the pairing or session response to show the destination.
2. Open a file picker. Accept PDF, DOC, DOCX, JPG, JPEG, PNG and HEIC up to 20 MiB (20,971,520 bytes). For multiple selections, send a separate request and generate a separate UUID for each file.
3. Upload after the operator confirms the selection. Show progress, success and a retry action. Save the transfer UUID with the pending upload so retries after a network interruption or app restart reuse the same UUID. Keep pending uploads tied to their original pairing.
4. On a successful receipt, show **Sent to Portal**. The Portal files it under the paired machine’s Documents tab even if nobody has the Portal open. The visible Documents tab checks for updates every 10 seconds.

## HTTP contract

Send `POST /mc/device/files` to the same API base URL used for pairing, with `Authorization: Bearer <deviceToken>`. The machine and organisation come from the token. Use `multipart/form-data` with these fields.

| Field | Value |
| --- | --- |
| `file` | One file with its original filename |
| `transferId` | UUID generated once for the send operation |
| `documentType` | Optional. `service_report`, `inspection`, `certificate`, or `other` (default) |

HTTP **201** returns a receipt with `id` (the machine document ID), `fileName`, `documentType`, and `uploadedAt` (ISO 8601 UTC). Repeating a transfer UUID on the same pairing returns the original receipt. Use a new UUID for an intentional new send.

- **400** indicates invalid fields, a missing file, or unsupported file content. Ask the operator to correct the selection.
- **401** with `DEVICE_TOKEN_REVOKED` indicates an invalid pairing credential. Recheck with the latest saved token in case rotation occurred during the upload. Clear the pairing and return to pairing if session validation also returns that code.
- **403** indicates that the machine is inactive or Machine Control is unavailable for its owning organisation.
- **413** indicates that the file exceeds the request size limit.
- For network failures and transient server errors, retry with backoff and the same transfer UUID.

The API requires migration `0133_machine_document_transfers`.

## PowerShell smoke test

Set `FIELD_DEVICE_TOKEN` in the current shell using the device token returned by pairing. Run against a test machine after the API and migration are deployed. Repeat the curl command without changing `$transferId` and verify that it returns the same document ID. Open **Machine app → View machine documents** in the Portal and confirm a single document appears.

```powershell
$api = 'https://staging-api.quiptechfield.com.au'
$file = 'C:\Temp\report.pdf'
$transferId = [guid]::NewGuid().ToString()

curl.exe --fail-with-body --silent --show-error "$api/mc/device/files" `
  -H "Authorization: Bearer $env:FIELD_DEVICE_TOKEN" `
  -F "transferId=$transferId" `
  -F "documentType=service_report" `
  -F "file=@$file"
```
