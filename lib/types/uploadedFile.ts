// What every upload endpoint returns for the stored file. `key` is the S3
// object key the backend keeps; `signedUrl` shows or downloads the file
// and expires after 15 minutes — re-fetch the record for a fresh one.
export interface UploadedFile {
  key: string;
  signedUrl: string;
  uploadedAt: string;
}
