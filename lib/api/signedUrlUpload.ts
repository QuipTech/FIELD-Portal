// Failures of the S3 step itself, as opposed to FIELD API errors.
export class StorageUploadError extends Error {}

// PUTs a file straight to storage (S3) with a pre-signed URL. XHR rather
// than fetch because fetch can't report upload progress.
export const uploadFileToSignedUrl = (
  upload: { url: string; headers: Record<string, string> },
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", upload.url);
    Object.entries(upload.headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new StorageUploadError(`Storage rejected the upload (HTTP ${request.status}).`));
    // A CORS rule missing on the bucket also lands here, with no status.
    request.onerror = () =>
      reject(new StorageUploadError("Couldn't reach document storage. Check your connection and try again."));
    request.send(file);
  });
