// A file as Nest/multer hands it to a controller (memory storage).
export interface IncomingFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// What an upload saved; `key` is what goes in the database.
export interface StoredFile {
  key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface SignedUrl {
  url: string;
  expiresAt: string;
}

// Returned to clients after an upload: the key plus a short-lived URL to
// show or download the file straight away.
export interface UploadedFile {
  key: string;
  signedUrl: string;
  uploadedAt: string;
}
